// pages/api/comments.js
// Comentários reais de vídeos + chat global da home — salva e carrega do banco
// Bots NÃO comentam em vídeos reais (apenas no chat da home)

import prisma from '../../lib/prisma'
import jwt from 'jsonwebtoken'

function shapeComment(c) {
  return {
    id:        c.id,
    text:      c.text,
    gifUrl:    c.gifUrl || null,
    createdAt: c.createdAt,
    user: {
      handle:     c.user.handle,
      name:       c.user.name,
      avatarUrl:  c.user.avatarUrl,
      isVerified: c.user.isVerified,
      isVip:      c.user.isVip,
    },
    reactions: (c.reactions || []).reduce((acc, r) => {
      acc[r.emoji] = acc[r.emoji] || { emoji: r.emoji, count: 0, byMe: false }
      acc[r.emoji].count++
      if (r.userId === c._meId) acc[r.emoji].byMe = true
      return acc
    }, {})
  }
}

function getUserId(req) {
  const authHeader = req.headers.authorization || ''
  const token = authHeader.replace('Bearer ', '').trim()
  if (!token) return null
  try {
    return jwt.verify(token, process.env.JWT_SECRET).userId
  } catch {
    return null
  }
}

export default async function handler(req, res) {

  // ── POST: salvar comentário (texto e/ou GIF) ──────────────
  if (req.method === 'POST') {
    const { text, gifUrl, videoId } = req.body

    if ((!text || !text.trim()) && !gifUrl)
      return res.status(400).json({ ok: false, error: 'Comentário vazio' })

    const isHomeComment = !videoId

    const userId = getUserId(req)
    if (!userId)
      return res.status(401).json({ ok: false, error: 'Login obrigatório para comentar' })

    try {
      if (!isHomeComment) {
        const video = await prisma.video.findUnique({ where: { id: videoId } })
        if (!video || video.removed)
          return res.status(404).json({ ok: false, error: 'Vídeo não encontrado' })
      }

      const comment = await prisma.comment.create({
        data: {
          text: (text || '').trim(),
          gifUrl: gifUrl || null,
          userId,
          videoId: isHomeComment ? null : videoId,
        },
        include: {
          user: { select: { handle: true, name: true, avatarUrl: true, isVerified: true, isVip: true } },
          reactions: true,
        }
      })

      comment.reactions.forEach(r => { r._meId = userId })
      return res.json({ ok: true, saved: true, comment: shapeComment({ ...comment, _meId: userId }) })
    } catch (e) {
      console.error('[comments POST]', e)
      return res.status(500).json({ ok: false, saved: false, error: 'Erro ao salvar comentário no servidor' })
    }

  // ── GET: carregar comentários (com suporte a polling via ?since=) ──
  } else if (req.method === 'GET') {
    const { videoId, since } = req.query
    if (!videoId)
      return res.status(400).json({ ok: false, error: 'videoId obrigatório' })

    const meId = getUserId(req)
    const isHome = videoId === 'home'

    const where = isHome
      ? { videoId: null }
      : { videoId, video: { removed: false } }

    if (since) {
      where.createdAt = { gt: new Date(since) }
    }

    try {
      const comments = await prisma.comment.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        take: since ? 100 : 200,
        include: {
          user: { select: { handle: true, name: true, avatarUrl: true, isVerified: true, isVip: true } },
          reactions: true,
        }
      })

      return res.json({
        ok: true,
        serverTime: new Date().toISOString(),
        comments: comments.map(c => shapeComment({ ...c, _meId: meId }))
      })
    } catch (e) {
      console.error('[comments GET]', e)
      return res.status(500).json({ ok: false, error: 'Erro ao buscar comentários' })
    }

  } else {
    return res.status(405).end()
  }
}
