// pages/api/rank.js
// Retorna top 5 canais reais (não bot) rankeados por likes totais + seguidores

import prisma from '../../lib/prisma'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  try {
    // Busca usuários reais com seus vídeos e contagem de likes
    const users = await prisma.user.findMany({
      where: { isBot: false },
      select: {
        id: true,
        handle: true,
        name: true,
        avatarUrl: true,
        isVerified: true,
        isVip: true,
        followers: true,
        totalViews: true,
        videos: {
          where: { removed: false },
          select: { likesCount: true, fakeLikeConv: true, fakeViews: true, views: true }
        }
      }
    })

    // Calcula score de cada usuário
    const ranked = users.map(u => {
      const totalLikes = u.videos.reduce((sum, v) => sum + (v.likesCount || 0) + (v.fakeLikeConv || 0), 0)
      const totalViews = u.videos.reduce((sum, v) => sum + (v.views || 0) + (v.fakeViews || 0), 0)
      const score = totalLikes + Math.floor(u.followers * 0.1) + Math.floor(totalViews * 0.001)
      return {
        handle:     u.handle,
        name:       u.name,
        avatarUrl:  u.avatarUrl,
        isVerified: u.isVerified,
        isVip:      u.isVip,
        followers:  u.followers,
        totalLikes,
        totalViews,
        score,
        videoCount: u.videos.length,
      }
    })

    // Ordena por score decrescente, pega top 5
    ranked.sort((a, b) => b.score - a.score)
    const top5 = ranked.slice(0, 5)

    // Prêmios e destaque por posição
    const prizes = [
      { rank: 1, label: '🏆 Campeão', color: '#f5a623', verified: true,  special: 'gold_frame' },
      { rank: 2, label: '🥈 Vice',    color: '#9ca3af', verified: true,  special: 'silver_frame' },
      { rank: 3, label: '🥉 Bronze',  color: '#b45309', verified: false, special: 'bronze_frame' },
      { rank: 4, label: '⭐ Destaque',color: '#0052e0', verified: false, special: null },
      { rank: 5, label: '🌟 Top 5',   color: '#7c3aed', verified: false, special: null },
    ]

    const result = top5.map((u, i) => ({ ...u, ...prizes[i] }))

    return res.json({ ok: true, rank: result })
  } catch (e) {
    console.error('[rank]', e)
    return res.status(500).json({ ok: false, error: e.message })
  }
}
