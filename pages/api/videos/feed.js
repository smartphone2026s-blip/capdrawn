// pages/api/videos/feed.js
// Feed de vídeos corrigido:
// - retorna views TOTAIS (reais + fake)
// - retorna info do bot distribuidor (se houver)
// - retorna likes totais (reais + fake)
// - suporta paginação e tab (all | following)

import prisma from '../../../lib/prisma'
import jwt from 'jsonwebtoken'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  try {
    const page  = Math.max(1, parseInt(req.query.page  || '1'))
    const limit = Math.min(50, parseInt(req.query.limit || '10'))
    const skip  = (page - 1) * limit
    const tab   = req.query.tab || 'all' // 'all' | 'shorts'

    // Para o feed de curtos: pega aleatório via orderBy rand-like (offset random)
    let orderBy = { createdAt: 'desc' }
    if (tab === 'shorts') {
      // Ordem aleatória: usa skip aleatório dentro do total
      const total = await prisma.video.count({ where: { removed: false, flagged: false } })
      const randomSkip = total > limit ? Math.floor(Math.random() * (total - limit)) : 0
      const videos = await prisma.video.findMany({
        where: { removed: false, flagged: false },
        include: {
          uploader: { select: { id: true, name: true, handle: true, avatarUrl: true, isVerified: true, isVip: true, isBot: true } },
          _count:   { select: { likes: true, comments: true } }
        },
        orderBy: { createdAt: 'asc' },
        take: limit,
        skip: randomSkip,
      })
      return res.json({ ok: true, videos: formatVideos(videos), page, limit })
    }

    const videos = await prisma.video.findMany({
      where: { removed: false, flagged: false },
      include: {
        uploader: { select: { id: true, name: true, handle: true, avatarUrl: true, isVerified: true, isVip: true, isBot: true } },
        _count:   { select: { likes: true, comments: true } }
      },
      orderBy,
      take: limit,
      skip,
    })

    // Para cada vídeo distribuído por bot, busca o bot
    const botHandles = [...new Set(videos.filter(v => v.botHandle).map(v => v.botHandle))]
    const bots = botHandles.length ? await prisma.user.findMany({
      where: { handle: { in: botHandles } },
      select: { handle: true, name: true, avatarUrl: true, isVerified: true, isVip: true, isBot: true }
    }) : []
    const botMap = Object.fromEntries(bots.map(b => [b.handle, b]))

    return res.json({
      ok: true,
      videos: formatVideos(videos, botMap),
      page,
      limit,
      hasMore: videos.length === limit,
    })
  } catch (e) {
    console.error('[feed]', e)
    return res.status(500).json({ ok: false, error: e.message })
  }
}

function formatVideos(videos, botMap = {}) {
  return videos.map(v => {
    const totalViews = (v.views || 0) + (v.fakeViews || 0)
    const totalLikes = (v.likesCount || 0) + (v.fakeLikeConv || 0)
    const distributor = v.botHandle ? (botMap[v.botHandle] || null) : null
    return {
      id:           v.id,
      url:          v.url,
      caption:      v.caption,
      thumbnailUrl: v.thumbnailUrl,
      views:        totalViews,
      likes:        totalLikes,
      comments:     v._count?.comments || 0,
      distributed:  v.distributed,
      botHandle:    v.botHandle || null,
      distributor,          // objeto do bot { handle, name, avatarUrl, ... }
      uploader:     v.uploader,
      createdAt:    v.createdAt,
    }
  })
}
