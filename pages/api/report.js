// pages/api/report.js
import { PrismaClient } from '@prisma/client'
import cloudinary from '../../lib/cloudinary'

const prisma = new PrismaClient()

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { videoId, type, subtype, reporterId } = req.body

  if (type === 'copyright' && subtype === 'owner') {
    const video = await prisma.video.findUnique({
      where: { id: videoId },
      select: { cloudinaryPublicId: true }
    })

    if (video?.cloudinaryPublicId) {
      try {
        await cloudinary.uploader.destroy(video.cloudinaryPublicId, { resource_type: 'video' })
      } catch (cloudErr) {
        console.error('[report] Cloudinary destroy error:', cloudErr)
      }
    }

    await prisma.video.update({ where: { id: videoId }, data: { removed: true } })
  }

  await prisma.report.create({
    data: {
      videoId,
      type,
      subtype: subtype || null,
      reporterId,
      status: subtype === 'owner' ? 'removed' : 'pending'
    }
  })

  res.json({ ok: true })
}
