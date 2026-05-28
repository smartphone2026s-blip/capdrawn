// pages/api/videos/upload.js

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

  const form = formidable({ maxFileSize: 200 * 1024 * 1024 })

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
      const caption      = fields.caption?.[0] || ''
      const distModeRaw  = fields.distMode?.[0] || ''
      const distBoolRaw  = fields.distributed?.[0] || 'false'
      const distMode     = distModeRaw || (distBoolRaw === 'true' ? 'bots' : 'profile')
      const botHandle    = fields.botHandle?.[0] || null

      const result = await cloudinary.uploader.upload(file.filepath, {
        resource_type: 'video',
        folder: 'capdrawnn/videos',
        transformation: [
          {
            quality:      'auto:good',
            fetch_format: 'auto',
            video_codec:  'auto',
            bit_rate:     '900k',
            width:        720,
            height:       1280,
            crop:         'limit',
          }
        ],
        eager: [
          { width: 320, height: 568, crop: 'fill', format: 'jpg', quality: 'auto' }
        ],
        eager_async: false,
      })

      const cloudUrl         = result.secure_url
      const cloudPublicId    = result.public_id
      const thumbnailUrl     = result.eager?.[0]?.secure_url || null
      const distributed      = distMode === 'bots' || distMode === 'both'

      let finalBotHandle = null
      let botUserId = null
      if (distributed && botHandle) {
        const bot = await prisma.user.findUnique({ where: { handle: botHandle, isBot: true } })
        if (bot) { finalBotHandle = bot.handle; botUserId = bot.id }
      }
      if (distributed && !finalBotHandle) {
        const randomBot = await prisma.user.findFirst({ where: { isBot: true }, orderBy: { createdAt: 'asc' } })
        if (randomBot) { finalBotHandle = randomBot.handle; botUserId = randomBot.id }
      }

      const effectiveUploaderId = (distributed && botUserId) ? botUserId : tokenUserId

      const video = await prisma.video.create({
        data: {
          url:                cloudUrl,
          thumbnailUrl,
          caption:            caption.trim() || null,
          distributed,
          botHandle:          finalBotHandle,
          uploaderId:         effectiveUploaderId,
          cloudinaryPublicId: cloudPublicId,
          sentById:           (distributed && botUserId) ? tokenUserId : null,
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
      const msg = e.message || ''
      const friendly = msg.toLowerCase().includes('too large')
        ? 'Vídeo muito grande para o servidor. Tente um vídeo menor (até ~150MB) ou mais curto.'
        : 'Falha no upload: ' + msg
      return res.status(500).json({ ok: false, error: friendly })
    }
  })
}
