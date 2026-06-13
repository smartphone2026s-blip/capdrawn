// pages/api/game/stats.js
// Atualiza kills/deaths/wins/losses ao fim de partida

import prisma from '../../../lib/prisma'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const authKey = req.headers['x-game-key']
  if (authKey !== process.env.GAME_SERVER_KEY) {
    return res.status(401).json({ token: '_error_' })
  }

  const { username, kills, deaths, won } = req.body

  try {
    const account = await prisma.gameAccount.findUnique({ where: { username } })
    if (!account) return res.json({ token: '_nofound_' })

    const newKills  = account.kills  + (kills  || 0)
    const newDeaths = account.deaths + (deaths || 0)
    const newWins   = account.wins   + (won ? 1 : 0)
    const newLosses = account.losses + (won ? 0 : 1)

    // Calcular rank simples por wins
    let rank = 'Low'
    if (newWins >= 100) rank = 'Pro'
    else if (newWins >= 50) rank = 'High'
    else if (newWins >= 20) rank = 'Medium'

    await prisma.gameAccount.update({
      where: { username },
      data: { kills: newKills, deaths: newDeaths, wins: newWins, losses: newLosses, rank }
    })

    return res.json({ token: '_statpartok_', rank })
  } catch (e) {
    return res.json({ token: '_screrror_' })
  }
}
