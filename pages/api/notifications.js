// pages/api/notifications.js
// Retorna notificações do usuário logado, marca como vistas

import { PrismaClient } from '@prisma/client'
import jwt from 'jsonwebtoken'

const globalForPrisma = globalThis
if (!globalForPrisma.prisma) globalForPrisma.prisma = new PrismaClient()
const prisma = globalForPrisma.prisma

export default async function handler(req, res) {
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim()
  if (!token) return res.status(401).json({ ok: false, error: 'Token obrigatório' })

  let userId
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    userId = decoded.userId
  } catch {
    return res.status(401).json({ ok: false, error: 'Token inválido' })
  }

  // GET — busca notificações não vistas
  if (req.method === 'GET') {
    try {
      const notifications = await prisma.notification.findMany({
        where: { userId, seen: false },
        orderBy: { createdAt: 'desc' },
        take: 20,
      })
      return res.json({ ok: true, notifications })
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message })
    }
  }

  // POST — marca como vista
  if (req.method === 'POST') {
    const { id } = req.body
    try {
      if (id) {
        await prisma.notification.updateMany({
          where: { id, userId },
          data: { seen: true }
        })
      } else {
        // Marca todas como vistas
        await prisma.notification.updateMany({
          where: { userId, seen: false },
          data: { seen: true }
        })
      }
      return res.json({ ok: true })
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message })
    }
  }

  res.status(405).end()
}
