// pages/api/videos/[id]/index.js
import prisma from '../../../../lib/prisma'
import cloudinary from '../../../../lib/cloudinary'
import jwt from 'jsonwebtoken'

export default async function handler(req, res) {
  if (req.method !== 'DELETE') return res.status(405).end()

  const { id } = req.query

  const authHeader = req.headers.authorization || ''
  const token = authHeader.replace('Bearer ', '').trim()
  if (!token) return res.status(401).json({ ok: false, error: 'Login necessário' })

  let userId
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    userId = decoded.userId
  } catch {
    return res.status(401).json({ ok: false, error: 'Token inválido' })
  }

  try {
    const video = await prisma.video.findUnique({
      where: { id },
      select: {
        id: true,
        uploaderId: true,
        sentById: true,
        cloudinaryPublicId: true,
      }
    })

    if (!video) return res.status(404).json({ ok: false, error: 'Vídeo não encontrado' })

    const isOwner = video.sentById === userId || video.uploaderId === userId
    if (!isOwner) return res.status(403).json({ ok: false, error: 'Sem permissão para apagar este vídeo' })

    if (video.cloudinaryPublicId) {
      try {
        await cloudinary.uploader.destroy(video.cloudinaryPublicId, { resource_type: 'video' })
      } catch (cloudErr) {
        console.error('[delete] Cloudinary error:', cloudErr)
      }
    }

    await prisma.video.delete({ where: { id } })

    return res.json({ ok: true })
  } catch (e) {
    console.error('[delete video]', e)
    return res.status(500).json({ ok: false, error: e.message })
  }
}
