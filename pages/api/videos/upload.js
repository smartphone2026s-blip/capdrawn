import { PrismaClient } from '@prisma/client'
import cloudinary from '../../../lib/cloudinary'
import formidable from 'formidable'
import jwt from 'jsonwebtoken'

export const config = { api: { bodyParser: false } }

// Singleton Prisma
const globalForPrisma = globalThis
if (!globalForPrisma.prisma) {
  globalForPrisma.prisma = new PrismaClient()
}
const prisma = globalForPrisma.prisma

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  // ── Pega token JWT do header (se tiver)
  let tokenUserId = null
  const authHeader = req.headers.authorization || ''
  const token = authHeader.replace('Bearer ', '').trim()
  if (token && process.env.JWT_SECRET) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET)
      tokenUserId = decoded.userId
    } catch (_) {}
  }

  const form = formidable({ maxFileSize: 100 * 1024 * 1024 }) // 100 MB

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error('formidable:', err)
      return res.status(400).json({ error: 'Erro ao ler arquivo: ' + err.message })
    }

    const file = files.video?.[0]
    if (!file) return res.status(400).json({ error: 'Nenhum vídeo enviado' })

    try {
      let uploaderId = tokenUserId

      // Fallback: busca pelo handle
      if (!uploaderId) {
        const uploaderHandle = fields.uploaderId?.[0]
        if (uploaderHandle) {
          const user = await prisma.user.findUnique({ where: { handle: uploaderHandle } })
          if (user) {
            uploaderId = user.id
          } else {
            const created = await prisma.user.create({
              data: {
                handle:   uploaderHandle,
                name:     uploaderHandle,
                email:    `${uploaderHandle}@capdrawnn.local`,
                password: 'offline_user',
              }
            })
            uploaderId = created.id
          }
        }
      }

      if (!uploaderId) {
        return res.status(401).json({ error: 'Faça login para enviar vídeos' })
      }

      // Valida tipo
      const mime = file.mimetype || ''
      if (!mime.startsWith('video/')) {
        return res.status(400).json({ error: 'Arquivo deve ser um vídeo' })
      }

      // Envia para Cloudinary
      const result = await cloudinary.uploader.upload(file.filepath, {
        resource_type: 'video',
        folder: 'capdrawnn/videos',
        transformation: [{ quality: 'auto' }],
      })

      // Salva no banco
      const video = await prisma.video.create({
        data: {
          url:         result.secure_url,
          caption:     fields.caption?.[0] || '',
          distributed: fields.distributed?.[0] === 'true',
          uploaderId,
        }
      })

      res.json({ ok: true, video, url: result.secure_url })
    } catch (e) {
      console.error('upload error:', e)
      res.status(500).json({ error: 'Falha no upload: ' + (e.message || 'erro desconhecido') })
    }
  })
}
