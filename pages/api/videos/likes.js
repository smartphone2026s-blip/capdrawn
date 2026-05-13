// pages/api/videos/likes.js
// Gerencia likes: salva no banco, retorna contagem correta e fixa

import prisma from '../../../lib/prisma'
import jwt from 'jsonwebtoken'

export default async function handler(req, res) {

  // ══ GET — retorna likes fixos de um vídeo ══
  if (req.method === 'GET') {
    const { videoId } = req.query
    if (!videoId) return res.status(400).json({ ok: false, error: 'videoId obrigatório' })

    try {
      const video = await prisma.video.findUnique({
        where: { id: videoId },
        select: { likesCount: true, views: true }
      })
      if (!video) return res.status(404).json({ ok: false, error: 'Vídeo não encontrado' })

      return res.json({ ok: true, likes: video.likesCount, views: video.views })
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message })
    }
  }

  // ══ POST — adiciona/remove like (toggle) ══
  if (req.method === 'POST') {
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

    const { videoId } = req.body
    if (!videoId) return res.status(400).json({ ok: false, error: 'videoId obrigatório' })

    try {
      const existing = await prisma.like.findUnique({
        where: { userId_videoId: { userId, videoId } }
      })

      let liked
      if (existing) {
        // Remove like
        await prisma.like.delete({ where: { userId_videoId: { userId, videoId } } })
        // Decrementa — mas NUNCA abaixo do valor atual salvo
        await prisma.video.update({
          where: { id: videoId },
          data: { likesCount: { decrement: 1 } }
        })
        liked = false
      } else {
        // Adiciona like
        await prisma.like.create({ data: { userId, videoId } })
        await prisma.video.update({
          where: { id: videoId },
          data: { likesCount: { increment: 1 } }
        })
        liked = true
      }

      // Retorna contagem atual do banco (sempre fixa e crescente)
      const updated = await prisma.video.findUnique({
        where: { id: videoId },
        select: { likesCount: true }
      })

      return res.json({ ok: true, liked, likes: updated.likesCount })
    } catch (e) {
      console.error('[likes POST]', e)
      return res.status(500).json({ ok: false, error: e.message })
    }
  }

  res.status(405).end()
}
