import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { handle, text, videoId } = req.body
    if (!handle || !text) return res.status(400).json({ error: 'handle e text obrigatórios' })

    try {
      // Busca o userId pelo handle
      const user = await prisma.user.findUnique({ where: { handle } })
      if (!user) return res.status(404).json({ error: 'Usuário não encontrado' })

      const comment = await prisma.comment.create({
        data: {
          text,
          userId:  user.id,
          videoId: videoId || null,
        }
      })
      res.json({ ok: true, comment })
    } catch (e) {
      console.error(e)
      res.status(500).json({ error: 'Erro ao salvar comentário' })
    }

  } else if (req.method === 'GET') {
    try {
      const comments = await prisma.comment.findMany({
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: { user: { select: { handle: true, name: true, avatarUrl: true } } }
      })
      res.json({ ok: true, comments })
    } catch (e) {
      res.status(500).json({ error: 'Erro ao buscar comentários' })
    }

  } else {
    res.status(405).end()
  }
}
