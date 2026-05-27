// pages/api/videos/[id]/interact.js
// Likes reais + views reais + atualiza fakeViews no banco
// GET /api/videos/[id]/interact?action=view   → incrementa view
// POST /api/videos/[id]/interact  body:{action:'like'} → toggle like

import prisma from '../../../../lib/prisma'
import jwt from 'jsonwebtoken'

export default async function handler(req, res) {
  const { id } = req.query

  // ── Registrar view (GET ou POST action=view) ─────────────
  if (req.method === 'POST' && req.body?.action === 'view') {
    try {
      const video = await prisma.video.update({
        where: { id },
        data: { views: { increment: 1 } }
      })
      return res.json({ ok: true, views: video.views, fakeViews: video.fakeViews })
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message })
    }
  }

  // ── Toggle like (POST action=like) ──────────────────────
  if (req.method === 'POST' && req.body?.action === 'like') {
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
      const existing = await prisma.like.findUnique({
        where: { userId_videoId: { userId, videoId: id } }
      })

      let liked
      if (existing) {
        await prisma.like.delete({ where: { id: existing.id } })
        await prisma.video.update({ where: { id }, data: { likesCount: { decrement: 1 } } })
        liked = false
      } else {
        await prisma.like.create({ data: { userId, videoId: id } })
        await prisma.video.update({ where: { id }, data: { likesCount: { increment: 1 } } })
        liked = true
      }

      const video = await prisma.video.findUnique({ where: { id }, select: { likesCount: true, fakeViews: true, fakeLikeConv: true } })
      const totalLikes = (video?.likesCount || 0) + (video?.fakeLikeConv || 0)

      return res.json({ ok: true, liked, totalLikes })
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message })
    }
  }

  // ── GET: buscar estado atual do vídeo ───────────────────
  if (req.method === 'GET') {
    try {
      const video = await prisma.video.findUnique({
        where: { id },
        select: { views: true, fakeViews: true, likesCount: true, fakeLikeConv: true, fakeFollowerConv: true }
      })
      if (!video) return res.status(404).json({ ok: false, error: 'Vídeo não encontrado' })

      const totalViews  = (video.views || 0) + (video.fakeViews || 0)
      const totalLikes  = (video.likesCount || 0) + (video.fakeLikeConv || 0)

      return res.json({ ok: true, views: totalViews, realViews: video.views, fakeViews: video.fakeViews, totalLikes })
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message })
    }
  }

  return res.status(405).end()
}
