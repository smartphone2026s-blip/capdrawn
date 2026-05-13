// pages/api/videos/upload.js
// Upload de vídeo: salva no Cloudinary, cria registro no banco,
// cria conta de bot online se distribuído, dispara notificação na 1ª publicação

import cloudinary from '../../../lib/cloudinary'
import { PrismaClient } from '@prisma/client'
import formidable from 'formidable'
import jwt from 'jsonwebtoken'

export const config = { api: { bodyParser: false } }

const globalForPrisma = globalThis
if (!globalForPrisma.prisma) globalForPrisma.prisma = new PrismaClient()
const prisma = globalForPrisma.prisma

// ══ Cria conta de bot no banco se ainda não existir ══
async function ensureBotExists(botHandle, botName) {
  try {
    const existing = await prisma.user.findUnique({ where: { handle: botHandle } })
    if (existing) return existing

    const bot = await prisma.user.create({
      data: {
        handle:     botHandle,
        name:       botName,
        email:      `${botHandle}@capdrawnn.local`,
        password:   'bot_account_no_login',
        isBot:      true,
        isVerified: Math.random() < 0.33, // 1/3 dos bots são verificados
        isVip:      Math.random() < 0.25,
        followers:  Math.floor(Math.random() * 12_000_000) + 100_000,
        bio:        'Canal da Rede Memes CapDrawn.',
      }
    })
    return bot
  } catch (e) {
    console.warn('[ensureBotExists]', botHandle, e.message)
    return null
  }
}

// ══ Likes iniciais simulados para dar sensação de viralização ══
function simulatedLikes(views) {
  // Taxa de conversão realista: ~10-20% de views viram likes nas primeiras horas
  return Math.floor(views * (0.10 + Math.random() * 0.10))
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  // Verifica JWT
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim()
  if (!token) return res.status(401).json({ ok: false, error: 'Token obrigatório' })

  let userId
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    userId = decoded.userId
  } catch {
    return res.status(401).json({ ok: false, error: 'Token inválido' })
  }

  const form = formidable({ maxFileSize: 100 * 1024 * 1024 })

  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(400).json({ ok: false, error: 'Erro ao ler arquivo: ' + err.message })

    const file = files.video?.[0]
    if (!file) return res.status(400).json({ ok: false, error: 'Nenhum vídeo enviado' })

    const caption     = fields.caption?.[0] || '🎥 Vídeo da comunidade'
    const distributed = fields.distributed?.[0] === 'true'
    const botHandle   = fields.botHandle?.[0] || null
    const botName     = fields.botName?.[0] || null

    try {
      // 1. Upload para Cloudinary
      const result = await cloudinary.uploader.upload(file.filepath, {
        resource_type: 'video',
        folder: 'capdrawnn/videos',
        transformation: [
          { quality: 'auto', fetch_format: 'mp4' }
        ]
      })

      // 2. Vídeos iniciais simulados para viralizar (crescentes)
      const initialViews   = Math.floor(Math.random() * 50_000) + 500
      const initialLikes   = simulatedLikes(initialViews)

      // 3. Salva vídeo no banco
      const video = await prisma.video.create({
        data: {
          url:          result.secure_url,
          thumbnailUrl: result.secure_url.replace('/upload/', '/upload/so_0/').replace('.mp4', '.jpg'),
          caption,
          uploaderId:   userId,
          distributed,
          views:        initialViews,
          likesCount:   initialLikes,
        }
      })

      // 4. Se distribuído via bots → garante que o bot existe no banco
      if (distributed && botHandle && botName) {
        await ensureBotExists(botHandle, botName)
      }

      // 5. Verifica se é a primeira publicação do usuário → cria notificação
      const videoCount = await prisma.video.count({
        where: { uploaderId: userId, removed: false }
      })

      let isFirstPublish = false
      if (videoCount === 1) {
        isFirstPublish = true
        await prisma.notification.create({
          data: {
            userId,
            type: 'first_publish',
            data: {
              videoId:    video.id,
              videoUrl:   result.secure_url,
              caption,
              likes:      initialLikes,
              views:      initialViews,
            }
          }
        })
      }

      return res.json({
        ok: true,
        url: result.secure_url,
        video: {
          id:         video.id,
          url:        video.url,
          caption:    video.caption,
          views:      video.views,
          likesCount: video.likesCount,
          distributed: video.distributed,
        },
        isFirstPublish,
      })

    } catch (e) {
      console.error('[upload video]', e)
      return res.status(500).json({ ok: false, error: 'Erro no upload: ' + e.message })
    }
  })
}
