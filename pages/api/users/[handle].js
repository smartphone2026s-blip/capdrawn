// pages/api/users/[handle].js
// Perfil de usuário corrigido:
// - Retorna videos com views TOTAIS (reais + fake)
// - Retorna likes TOTAIS
// - Retorna totalViews e followers atualizados
// - Suporta vídeos distribuídos por bots (exibe na conta do bot)

import { PrismaClient } from '@prisma/client'
import jwt from 'jsonwebtoken'

const globalForPrisma = globalThis
if (!globalForPrisma.prisma) globalForPrisma.prisma = new PrismaClient()
const prisma = globalForPrisma.prisma

export default async function handler(req, res) {
  const { handle } = req.query

  // ── GET: buscar perfil + vídeos ──────────────────────────
  if (req.method === 'GET') {
    try {
      const user = await prisma.user.findUnique({
        where: { handle },
        include: {
          videos: {
            where: { removed: false },
            orderBy: { createdAt: 'desc' },
            include: {
              _count: { select: { likes: true, comments: true } }
            }
          }
        }
      })
      if (!user) return res.status(404).json({ ok: false, error: 'Usuário não encontrado' })

      // Para bots: busca vídeos onde botHandle = handle (vídeos que o bot está distribuindo)
      let botVideos = []
      if (user.isBot) {
        botVideos = await prisma.video.findMany({
          where: { botHandle: handle, removed: false },
          orderBy: { createdAt: 'desc' },
          include: {
            uploader: { select: { handle: true, name: true, avatarUrl: true } },
            _count: { select: { likes: true, comments: true } }
          }
        })
      }

      // Formata vídeos com totais
      const formatVideo = (v, isBotVideo = false) => ({
        id:           v.id,
        url:          v.url,
        thumbnailUrl: v.thumbnailUrl,
        caption:      v.caption,
        views:        (v.views || 0) + (v.fakeViews || 0),
        likes:        (v.likesCount || 0) + (v.fakeLikeConv || 0),
        comments:     v._count?.comments || 0,
        distributed:  v.distributed,
        botHandle:    v.botHandle,
        uploader:     isBotVideo ? v.uploader : null, // só bots exibem o uploader original
        createdAt:    v.createdAt,
      })

      const allVideos = user.isBot
        ? botVideos.map(v => formatVideo(v, true))
        : user.videos.map(v => formatVideo(v, false))

      // Totais do canal
      const totalLikes = user.videos.reduce((s, v) => s + (v.likesCount || 0) + (v.fakeLikeConv || 0), 0)
      const totalViews = user.totalViews || user.videos.reduce((s, v) => s + (v.views || 0) + (v.fakeViews || 0), 0)

      return res.json({
        ok: true,
        user: {
          id:          user.id,
          handle:      user.handle,
          name:        user.name,
          avatarUrl:   user.avatarUrl,
          bio:         user.bio,
          area:        user.area,
          isVip:       user.isVip,
          isVerified:  user.isVerified,
          isBot:       user.isBot,
          followers:   user.followers,
          totalViews,
          totalLikes,
          videoCount:  allVideos.length,
          createdAt:   user.createdAt,
          link:        user.link,
          channelEmail: user.channelEmail,
        },
        videos: allVideos
      })
    } catch (e) {
      console.error('[handle GET]', e)
      return res.status(500).json({ ok: false, error: e.message })
    }

  // ── PUT: atualizar perfil ────────────────────────────────
  } else if (req.method === 'PUT') {
    const authHeader = req.headers.authorization || ''
    const token = authHeader.replace('Bearer ', '').trim()
    if (!token) return res.status(401).json({ ok: false, error: 'Token obrigatório' })

    let userId
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET)
      userId = decoded.userId
    } catch {
      return res.status(401).json({ ok: false, error: 'Token inválido' })
    }

    const { name, desc, link } = req.body
    try {
      const user = await prisma.user.update({
        where: { handle },
        data: {
          ...(name              !== undefined && { name }),
          ...(desc              !== undefined && { bio: desc }),
          ...(link              !== undefined && { link }),
        }
      })
      return res.json({ ok: true, user })
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message })
    }

  } else {
    return res.status(405).end()
  }
}
