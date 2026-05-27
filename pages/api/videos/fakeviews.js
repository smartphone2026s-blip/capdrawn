// pages/api/videos/fakeviews.js
// Chamado pelo próprio frontend na inicialização (ou via cron externo)
// Para cada vídeo que não atingiu o teto de views fake, incrementa gradativamente
// Alvo: entre 2K e 50K (maioria), com chance de chegar em milhões/bilhões

import prisma from '../../../lib/prisma'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  try {
    // Busca vídeos ativos que ainda não atingiram o teto
    const videos = await prisma.video.findMany({
      where: { removed: false, flagged: false },
      select: { id: true, fakeViews: true, fakeFollowerConv: true, fakeLikeConv: true, uploaderId: true }
    })

    const updates = []

    for (const v of videos) {
      // Define teto aleatório de views fake para este vídeo se ainda não tiver (baseado no id)
      // Usamos o hash do id para determinar o teto de forma determinística
      const hash = v.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
      const rand01 = (hash % 1000) / 1000

      let targetViews
      if (rand01 < 0.60) {
        // 60% dos vídeos: 2K–50K
        targetViews = 2000 + Math.floor(rand01 * 10 * 48000)
      } else if (rand01 < 0.85) {
        // 25% dos vídeos: 50K–5M
        targetViews = 50000 + Math.floor((rand01 - 0.60) * 4 * 19_800_000)
      } else if (rand01 < 0.97) {
        // 12% dos vídeos: 5M–500M
        targetViews = 5_000_000 + Math.floor((rand01 - 0.85) * 8.33 * 495_000_000)
      } else {
        // 3% dos vídeos: 500M–5B (viral extremo)
        targetViews = 500_000_000 + Math.floor((rand01 - 0.97) * 33.3 * 4_500_000_000)
      }

      if (v.fakeViews >= targetViews) continue // já atingiu o teto

      // Incremento desta rodada: 1% do teto ou pelo menos 10
      const increment = Math.max(10, Math.floor(targetViews * 0.01))
      const newFakeViews = Math.min(v.fakeViews + increment, targetViews)

      // Conversão: 2% em seguidores, 10% em likes (sobre o delta acumulado)
      const delta = newFakeViews - v.fakeViews
      const newFollConv  = v.fakeFollowerConv + Math.floor(delta * 0.02)
      const newLikeConv  = v.fakeLikeConv    + Math.floor(delta * 0.10)

      updates.push(
        prisma.video.update({
          where: { id: v.id },
          data: {
            fakeViews:        newFakeViews,
            fakeFollowerConv: newFollConv,
            fakeLikeConv:     newLikeConv,
          }
        }),
        // Atualiza totalViews do canal do uploader
        prisma.user.update({
          where: { id: v.uploaderId },
          data: { totalViews: { increment: delta } }
        }),
        // Atualiza seguidores do uploader com a conversão
        prisma.user.update({
          where: { id: v.uploaderId },
          data: { followers: { increment: Math.floor(delta * 0.02) } }
        })
      )
    }

    if (updates.length) {
      await prisma.$transaction(updates)
    }

    return res.json({ ok: true, updated: updates.length / 3 })
  } catch (e) {
    console.error('[fakeviews]', e)
    return res.status(500).json({ ok: false, error: e.message })
  }
}
