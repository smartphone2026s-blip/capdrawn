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

  // Aceita até 200MB no formidable (o Cloudinary vai comprimir)
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
      const caption   = fields.caption?.[0] || ''
      // distMode vem do campo 'distMode' (profile|bots|both)
      // 'distributed' é boolean string 'true'/'false' — fallback para compatibilidade
      const distModeRaw  = fields.distMode?.[0] || ''
      const distBoolRaw  = fields.distributed?.[0] || 'false'
      const distMode     = distModeRaw || (distBoolRaw === 'true' ? 'bots' : 'profile')
      const botHandle    = fields.botHandle?.[0] || null

      // ── Cloudinary: compressão inteligente + rápida ──────────────────────
      // - quality: 'auto:good'  → Cloudinary analisa o conteúdo e comprime
      //   sem artefatos visíveis. 'auto:best' preserva mais, 'auto:eco' comprime mais.
      // - fetch_format: 'auto'  → entrega mp4/webm conforme o browser
      // - video_codec: 'auto'   → escolhe H.264 ou VP9 automaticamente
      // - bit_rate: '800k'      → teto de bitrate — suficiente pra short 720p
      //   (TikTok usa ~1.5Mbps; 800k já é imperceptível pra meme)
      // - width/height + crop   → redimensiona pra 720p vertical se vier maior
      // - flags: 'streaming_attachment' → streaming progressivo (começa rápido)
      // ─────────────────────────────────────────────────────────────────────
      const result = await cloudinary.uploader.upload(file.filepath, {
        resource_type: 'video',
        folder: 'capdrawnn/videos',
        transformation: [
          {
            quality:      'auto:good',   // compressão inteligente, qualidade boa
            fetch_format: 'auto',        // formato ideal por browser
            video_codec:  'auto',        // H.264 ou VP9 conforme suporte
            bit_rate:     '900k',        // teto de bitrate (short de meme não precisa mais)
            width:        720,           // limita a 720p de largura
            height:       1280,          // altura máxima 1280 (9:16)
            crop:         'limit',       // só reduz, nunca aumenta
          }
        ],
        eager: [
          // thumbnail 9:16 para preview
          { width: 320, height: 568, crop: 'fill', format: 'jpg', quality: 'auto' }
        ],
        eager_async: false, // aguarda thumbnail antes de retornar
      })

      const cloudUrl     = result.secure_url
      const thumbnailUrl = result.eager?.[0]?.secure_url || null
      const distributed  = distMode === 'bots' || distMode === 'both'

      // Resolve bot distribuidor
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

      // Modo bot: uploaderId = bot (vídeo aparece no perfil do bot)
      const effectiveUploaderId = (distributed && botUserId) ? botUserId : tokenUserId

      const video = await prisma.video.create({
        data: {
          url:          cloudUrl,
          thumbnailUrl,
          caption:      caption.trim() || null,
          distributed,
          botHandle:    finalBotHandle,
          uploaderId:   effectiveUploaderId,
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
      // Mensagem amigável para erro de tamanho do Cloudinary
      const msg = e.message || ''
      const friendly = msg.toLowerCase().includes('too large')
        ? 'Vídeo muito grande para o servidor. Tente um vídeo menor (até ~150MB) ou mais curto.'
        : 'Falha no upload: ' + msg
      return res.status(500).json({ ok: false, error: friendly })
    }
  })
}
