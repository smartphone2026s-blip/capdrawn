// pages/api/users/[handle].js
// GET: retorna perfil + vídeos com likes/views reais do banco
// PUT: atualiza nome, bio, link e avatar (via Cloudinary se base64 enviado)

import { PrismaClient } from '@prisma/client'
import cloudinary from '../../../lib/cloudinary'
import jwt from 'jsonwebtoken'

const globalForPrisma = globalThis
if (!globalForPrisma.prisma) globalForPrisma.prisma = new PrismaClient()
const prisma = globalForPrisma.prisma

export default async function handler(req, res) {
  const { handle } = req.query

  // ══ GET — busca perfil completo com vídeos reais ══
  if (req.method === 'GET') {
    try {
      const user = await prisma.user.findUnique({
        where: { handle },
        include: {
          videos: {
            where: { removed: false },
            orderBy: { createdAt: 'desc' },
            select: {
              id:          true,
              url:         true,
              thumbnailUrl: true,
              caption:     true,
              views:       true,
              likesCount:  true,
              distributed: true,
              createdAt:   true,
              _count: { select: { comments: true } }
            }
          }
        }
      })

      if (!user) return res.status(404).json({ ok: false, error: 'Usuário não encontrado' })

      // Nunca expõe senha ou email de bots
      const { password, ...safeUser } = user

      return res.json({ ok: true, user: safeUser })
    } catch (e) {
      console.error('[handle GET]', e)
      return res.status(500).json({ ok: false, error: 'Erro ao buscar usuário: ' + e.message })
    }
  }

  // ══ PUT — atualiza perfil (requer JWT) ══
  if (req.method === 'PUT') {
    const token = (req.headers.authorization || '').replace('Bearer ', '').trim()
    if (!token) return res.status(401).json({ ok: false, error: 'Token obrigatório' })

    let tokenUserId
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET)
      tokenUserId = decoded.userId
    } catch {
      return res.status(401).json({ ok: false, error: 'Token inválido' })
    }

    // Garante que o usuário só pode editar o próprio perfil
    const owner = await prisma.user.findUnique({ where: { handle } })
    if (!owner) return res.status(404).json({ ok: false, error: 'Usuário não encontrado' })
    if (owner.id !== tokenUserId) return res.status(403).json({ ok: false, error: 'Sem permissão' })

    const { name, bio, link, avatarBase64 } = req.body

    try {
      let avatarUrl = undefined

      // Upload do avatar para Cloudinary se base64 foi enviado
      if (avatarBase64) {
        const result = await cloudinary.uploader.upload(avatarBase64, {
          resource_type: 'image',
          folder: 'capdrawnn/avatars',
          transformation: [
            { width: 200, height: 200, crop: 'fill', gravity: 'face' },
            { quality: 'auto', fetch_format: 'auto' }
          ]
        })
        avatarUrl = result.secure_url
      }

      const updated = await prisma.user.update({
        where: { handle },
        data: {
          ...(name !== undefined      && { name }),
          ...(bio  !== undefined      && { bio }),
          ...(link !== undefined      && { link }),
          ...(avatarUrl !== undefined && { avatarUrl }),
        }
      })

      const { password, email, ...safeUser } = updated
      return res.json({ ok: true, user: safeUser })

    } catch (e) {
      console.error('[handle PUT]', e)
      return res.status(500).json({ ok: false, error: 'Erro ao atualizar perfil: ' + e.message })
    }
  }

  res.status(405).end()
}
