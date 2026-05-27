// pages/api/videos/upload.js
// Upload corrigido:
// - Salva botHandle no vídeo quando o usuário escolhe distribuição por bot
// - O vídeo fica na conta do bot no banco, não na do usuário
// - Retorna URL do Cloudinary salva permanentemente

import cloudinary from '../../../lib/cloudinary'
import { PrismaClient } from '@prisma/client'
import formidable from 'formidable'
import jwt from 'jsonwebtoken'

export const config = { api: { bodyParser: false } }

const globalForPrisma = globalThis
if (!globalForPrisma.prisma) globalForPrisma.prisma = new PrismaClient()
const prisma = globalForPrisma.prisma

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  // Token JWT obrigatório
  let tokenUserId = null
  const authHeader = req.headers.authorization || ''
  const token = authHeader.replace('Bearer ', '').trim()
  if (token && process.env.JWT_SECRET) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET)
      tokenUserId = decoded.userId
    } catch (_) {}
  }

  if (!tokenUserId) {
    return res.status(401).json({ ok: false, error: 'Login obrigatório para enviar vídeos' })
  }

  const form = formidable({ maxFileSize: 200 * 1024 * 1024 }) // 200 MB

  form.parse(req, async (err, fields, files) => {
    if (err) {
      return res.status(400).json({ ok: false, error: 'Erro ao ler arquivo: ' + err.message })
    }

    const file = files.video?.[0]
    if (!file) return res.status(400).json({ ok: false, error: 'Nenhum vídeo enviado' })

    const mime = file.mimetype || ''
    if (!mime.startsWith('video/')) {
      return res.status(400).json({ ok: false, error: 'Arquivo deve ser um vídeo' })
    }

    try {
      const caption     = fields.caption?.[0] || ''
      const distMode    = fields.distributed?.[0] || 'profile' // 'profile' | 'bots' | 'both'
      const botHandle   = fields.botHandle?.[0] || null        // handle do bot escolhido

      // Sobe para Cloudinary
      const result = await cloudinary.uploader.upload(file.filepath, {
        resource_type: 'video',
        folder: 'capdrawnn/videos',
        transformation: [{ quality: 'auto' }],
        eager: [{ width: 320, height: 568, crop: 'fill', format: 'jpg' }], // thumbnail
      })

      const cloudUrl       = result.secure_url
      const thumbnailUrl   = result.eager?.[0]?.secure_url || null
      const distributed    = distMode === 'bots' || distMode === 'both'

      // Se modo bot: o uploaderId é o usuário real, mas botHandle aponta quem vai exibir
      // Se modo perfil: vai para o perfil do usuário
      let finalBotHandle = null
      if (distributed && botHandle) {
        // Verifica se o bot existe no banco
        const bot = await prisma.user.findUnique({ where: { handle: botHandle, isBot: true } })
        if (bot) finalBotHandle = bot.handle
      }

      const video = await prisma.video.create({
        data: {
          url:          cloudUrl,
          thumbnailUrl,
          caption:      caption.trim() || null,
          distributed,
          botHandle:    finalBotHandle,
          uploaderId:   tokenUserId,
        }
      })

      return res.json({
        ok:    true,
        video: {
          id:           video.id,
          url:          video.url,
          thumbnailUrl: video.thumbnailUrl,
          caption:      video.caption,
          distributed:  video.distributed,
          botHandle:    video.botHandle,
        },
        url: cloudUrl,
      })
    } catch (e) {
      console.error('[upload]', e)
      return res.status(500).json({ ok: false, error: 'Falha no upload: ' + e.message })
    }
  })
}
