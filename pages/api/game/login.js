// pages/api/game/login.js

import prisma from '../../../lib/prisma'
import bcrypt from 'bcryptjs'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const authKey = req.headers['x-game-key']
  if (authKey !== process.env.GAME_SERVER_KEY) {
    return res.status(401).json({ token: '_error_' })
  }

  const { username, password, temporary } = req.body

  if (!username || !password) {
    return res.json({ token: '_connloginerror_' })
  }

  const account = await prisma.gameAccount.findUnique({ where: { username } })

  if (!account) {
    return res.json({ token: '_connloginerror_' })
  }

  const valid = await bcrypt.compare(password, account.password)
  if (!valid) {
    return res.json({ token: '_connloginerror_' })
  }

  // Marcar como online
  await prisma.gameAccount.update({
    where: { id: account.id },
    data: { isOnline: true, lastSeen: new Date() }
  })

  if (temporary) {
    return res.json({
      token: '_conntmpok_',
      username: account.username,
      rank: account.rank,
      kills: account.kills,
      deaths: account.deaths,
      wins: account.wins,
    })
  }

  return res.json({
    token: '_connloginok_',
    username: account.username,
    rank: account.rank,
    kills: account.kills,
    deaths: account.deaths,
    wins: account.wins,
  })
}
