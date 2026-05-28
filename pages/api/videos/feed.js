// pages/api/videos/feed.js
import prisma from '../../../lib/prisma'
import jwt from 'jsonwebtoken'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  try {
    const page  = Math.max(1, parseInt(req.query.page  || '1'))
    const limit = Math.min(50, parseInt(req.query.limit || '10'))
    const skip  = (page - 1) * limit
    const tab   = req.query.tab || 'all'

    if (tab === 'shorts') {
      const total = await prisma.video.count({ where: { removed: false, flagged: false } })
      const randomSkip = total > limit ? Math.floor(Math.random() * (total - limit)) : 0
      const videos = await prisma.video.findMany({
        where: { removed: false, flagged: false },
        include: {
          uploader: { select: { id: true, name: true, handle: true, avatarUrl: true, isVerified: true, isVip: true, isBot: true } },
          sentBy:   { select: { id: true, name: true, handle: true, avatarUrl: true, isVerified: true, isVip: true } },
          _count:   { select: { likes: true, comments: true } }
        },
        orderBy: { createdAt: 'asc' },
        take: limit,
        skip: randomSkip,
      })
      const shortsBotHandles = [...new Set(videos.filter(v => v.botHandle).map(v => v.botHandle))]
      const shortsBots = shortsBotHandles.length ? await prisma.user.findMany({
        where: { handle: { in: shortsBotHandles } },
        select: { handle: true, name: true, avatarUrl: true, isVerified: true, isVip: true, isBot: true }
      }) : []
      const shortsBotMap = Object.fromEntries(shortsBots.map(b => [b.handle, b]))
      return res.json({ ok: true, videos: formatVideos(videos, shortsBotMap), page, limit })
    }

    const videos = await prisma.video.findMany({
      where: { removed: false, flagged: false },
      include: {
        uploader: { select: { id: true, name: true, handle: true, avatarUrl: true, isVerified: true, isVip: true, isBot: true } },
        sentBy:   { select: { id: true, name: true, handle: true, avatarUrl: true, isVerified: true, isVip: true } },
        _count:   { select: { likes: true, comments: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip,
    })

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
    const isDistributed = v.distributed === true || v.distributed === 'true'
    let distributor = null
    if (isDistributed && v.botHandle) {
      distributor = botMap[v.botHandle] || null
      if (!distributor) {
        distributor = { handle: v.botHandle, name: v.botHandle, avatarUrl: null, isVerified: false, isVip: false, isBot: true }
      }
    }
    return {
      id:           v.id,
      url:          v.url,
      caption:      v.caption,
      thumbnailUrl: v.thumbnailUrl,
      views:        totalViews,
      likes:        totalLikes,
      comments:     v._count?.comments || 0,
      distributed:  isDistributed,
      botHandle:    v.botHandle || null,
      distributor,
      uploader:     v.uploader,
      sentBy:       v.sentBy ? { id: v.sentBy.id, handle: v.sentBy.handle, name: v.sentBy.name, avatarUrl: v.sentBy.avatarUrl, isVerified: v.sentBy.isVerified, isVip: v.sentBy.isVip } : null,
      createdAt:    v.createdAt,
    }
  })
}
