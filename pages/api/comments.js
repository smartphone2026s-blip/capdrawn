// pages/api/comments.js
// Comentários reais de vídeos — salva e carrega do banco de dados
// Bots NÃO comentam em vídeos reais (apenas no chat da home)

import prisma from '../../lib/prisma'
import jwt from 'jsonwebtoken'

export default async function handler(req, res) {

  // ── POST: salvar comentário ──────────────────────────────
  if (req.method === 'POST') {
    const { text, videoId } = req.body

    if (!text || !text.trim())
      return res.status(400).json({ ok: false, error: 'Comentário vazio' })

    // videoId null/undefined = comentário da home (chat da comunidade)
    const isHomeComment = !videoId

    // Requer autenticação JWT
    const authHeader = req.headers.authorization || ''
    const token = authHeader.replace('Bearer ', '').trim()
    if (!token)
      return res.status(401).json({ ok: false, error: 'Login obrigatório para comentar' })

    let userId
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET)
      userId = decoded.userId
    } catch {
      return res.status(401).json({ ok: false, error: 'Token inválido' })
    }

    try {
      // Para comentários da home, não verifica vídeo
      if (!isHomeComment) {
        const video = await prisma.video.findUnique({ where: { id: videoId } })
        if (!video || video.removed)
          return res.status(404).json({ ok: false, error: 'Vídeo não encontrado' })
      }

      const comment = await prisma.comment.create({
        data: {
          text: text.trim(),
          userId,
          videoId: isHomeComment ? null : videoId,
        },
        include: {
          user: { select: { handle: true, name: true, avatarUrl: true, isVerified: true, isVip: true } }
        }
      })

      // Confirmação explícita de que foi salvo
      return res.json({
        ok: true,
        saved: true,   // frontend usa isso para mostrar "✅ Comentário salvo!"
        comment: {
          id:        comment.id,
          text:      comment.text,
          createdAt: comment.createdAt,
          user: {
            handle:     comment.user.handle,
            name:       comment.user.name,
            avatarUrl:  comment.user.avatarUrl,
            isVerified: comment.user.isVerified,
            isVip:      comment.user.isVip,
          }
        }
      })
    } catch (e) {
      console.error('[comments POST]', e)
      return res.status(500).json({ ok: false, saved: false, error: 'Erro ao salvar comentário no servidor' })
    }

  // ── GET: carregar comentários de um vídeo ──────────────────
  } else if (req.method === 'GET') {
    const { videoId } = req.query
    if (!videoId)
      return res.status(400).json({ ok: false, error: 'videoId obrigatório' })

    // videoId=home → retorna comentários da comunidade (sem videoId no banco)
    if (videoId === 'home') {
      try {
        const comments = await prisma.comment.findMany({
          where: { videoId: null },
          orderBy: { createdAt: 'asc' },
          take: 200,
          include: {
            user: {
              select: { handle: true, name: true, avatarUrl: true, isVerified: true, isVip: true }
            }
          }
        })
        return res.json({
          ok: true,
          comments: comments.map(c => ({
            id:        c.id,
            text:      c.text,
            createdAt: c.createdAt,
            user: {
              handle:     c.user.handle,
              name:       c.user.name,
              avatarUrl:  c.user.avatarUrl,
              isVerified: c.user.isVerified,
              isVip:      c.user.isVip,
            }
          }))
        })
      } catch (e) {
        console.error('[comments GET home]', e)
        return res.status(500).json({ ok: false, error: 'Erro ao buscar comentários da home' })
      }
    }

    try {
      const comments = await prisma.comment.findMany({
        where: { videoId, video: { removed: false } },
        orderBy: { createdAt: 'asc' },
        take: 200,
        include: {
          user: {
            select: { handle: true, name: true, avatarUrl: true, isVerified: true, isVip: true }
          }
        }
      })

      return res.json({
        ok: true,
        comments: comments.map(c => ({
          id:        c.id,
          text:      c.text,
          createdAt: c.createdAt,
          user: {
            handle:     c.user.handle,
            name:       c.user.name,
            avatarUrl:  c.user.avatarUrl,
            isVerified: c.user.isVerified,
            isVip:      c.user.isVip,
          }
        }))
      })
    } catch (e) {
      console.error('[comments GET]', e)
      return res.status(500).json({ ok: false, error: 'Erro ao buscar comentários' })
    }

  } else {
    return res.status(405).end()
  }
}
