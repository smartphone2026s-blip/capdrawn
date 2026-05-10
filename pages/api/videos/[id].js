import { PrismaClient } from '@prisma/client'
import jwt from 'jsonwebtoken'

const globalForPrisma = globalThis
if (!globalForPrisma.prisma) {
  globalForPrisma.prisma = new PrismaClient()
}
const prisma = globalForPrisma.prisma

export default async function handler(req, res) {
  if (req.method !== 'DELETE') return res.status(405).end()

  // Verifica JWT
  const authHeader = req.headers.authorization || ''
  const token = authHeader.replace('Bearer ', '').trim()
  if (!token) return res.status(401).json({ ok: false, error: 'Token obrigatório' })

  let userId
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    userId = decoded.userId
  } catch {
    return res.status(401).json({ ok: false, error: 'Token inválido' })
  }

  const { id } = req.query

  try {
    // Verifica se o vídeo pertence ao usuário
    const video = await prisma.video.findUnique({ where: { id } })
    if (!video) return res.status(404).json({ ok: false, error: 'Vídeo não encontrado' })
    if (video.uploaderId !== userId) return res.status(403).json({ ok: false, error: 'Sem permissão' })

    // Marca como removido (soft delete)
    await prisma.video.update({
      where: { id },
      data: { removed: true }
    })

    res.json({ ok: true })
  } catch (e) {
    console.error('delete video error:', e)
    res.status(500).json({ ok: false, error: 'Erro ao excluir vídeo' })
  }
}
