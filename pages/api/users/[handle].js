import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default async function handler(req, res) {
  const { handle } = req.query

  if (req.method === 'PUT') {
    const { name, desc, avatar, color } = req.body
    try {
      const user = await prisma.user.update({
        where: { handle },
        data: {
          ...(name             && { name }),
          ...(desc !== undefined && { bio: desc }),
          ...(avatar !== undefined && { avatarUrl: avatar }),
        }
      })
      res.json({ ok: true, user })
    } catch (e) {
      console.error(e)
      res.status(500).json({ error: 'Erro ao atualizar perfil' })
    }

  } else if (req.method === 'GET') {
    try {
      const user = await prisma.user.findUnique({
        where: { handle },
        include: { videos: true }
      })
      if (!user) return res.status(404).json({ error: 'Usuário não encontrado' })
      res.json({ ok: true, user })
    } catch (e) {
      res.status(500).json({ error: 'Erro ao buscar usuário' })
    }

  } else {
    res.status(405).end()
  }
}
