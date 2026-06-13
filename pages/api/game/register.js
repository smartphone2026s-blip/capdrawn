// pages/api/game/register.js
// Chamado pelo servidor UDP quando recebe pedido de registro

import prisma from '../../../lib/prisma'
import bcrypt from 'bcryptjs'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  // Validar chave interna (o servidor UDP envia isso)
  const authKey = req.headers['x-game-key']
  if (authKey !== process.env.GAME_SERVER_KEY) {
    return res.status(401).json({ token: '_error_' })
  }

  const { username, password } = req.body

  if (!username || !password || username.length < 3 || password.length < 4) {
    return res.json({ token: '_regerror_' })
  }

  // Verificar se username já existe
  const existing = await prisma.gameAccount.findUnique({ where: { username } })
  if (existing) {
    return res.json({ token: '_regloginerror_' })
  }

  try {
    const hash = await bcrypt.hash(password, 10)
    await prisma.gameAccount.create({
      data: { username, password: hash }
    })
    return res.json({ token: '_regok_' })
  } catch (e) {
    return res.json({ token: '_regerror_' })
  }
}
