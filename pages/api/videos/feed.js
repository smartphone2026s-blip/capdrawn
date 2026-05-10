import prisma from '../../../lib/prisma'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  try {
    const page  = parseInt(req.query.page  || '1')
    const limit = parseInt(req.query.limit || '20')
    const skip  = (page - 1) * limit

    const videos = await prisma.video.findMany({
      where: { removed: false, flagged: false },
      include: {
        uploader: { select: { name: true, handle: true, avatarUrl: true } },
        _count: { select: { likes: true, comments: true } }
      },
      orderBy: { createdAt: 'desc' },
      take:  limit,
      skip,
    })

    res.json({ ok: true, videos, page, limit })
  } catch (e) {
    console.error('[feed] erro:', e)
    res.status(500).json({ error: 'Erro ao buscar vídeos', detail: e.message })
  }
}
