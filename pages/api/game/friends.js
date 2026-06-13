// pages/api/game/friends.js
// _addfrok_ / _frlist_ / _frreqok_ / _delfrndok_

import prisma from '../../../lib/prisma'

export default async function handler(req, res) {
  const authKey = req.headers['x-game-key']
  if (authKey !== process.env.GAME_SERVER_KEY) {
    return res.status(401).json({ token: '_error_' })
  }

  const { action, username, targetUsername } = req.body || req.query

  // Listar amigos
  if (req.method === 'GET') {
    const account = await prisma.gameAccount.findUnique({ where: { username } })
    if (!account) return res.json({ token: '_nofound_' })

    const friends = await prisma.gameFriend.findMany({
      where: { ownerId: account.id },
      include: { target: { select: { username: true, rank: true, isOnline: true } } }
    })
    const requests = await prisma.gameFriendReq.findMany({
      where: { receiverId: account.id },
      include: { sender: { select: { username: true } } }
    })

    return res.json({
      token: '_frlist_',
      friends: friends.map(f => f.target),
      requests: requests.map(r => r.sender.username)
    })
  }

  if (req.method === 'POST') {
    const owner  = await prisma.gameAccount.findUnique({ where: { username } })
    const target = await prisma.gameAccount.findUnique({ where: { username: targetUsername } })
    if (!owner || !target) return res.json({ token: '_nofound_' })

    // Enviar pedido de amizade
    if (action === 'request') {
      const existing = await prisma.gameFriendReq.findUnique({
        where: { senderId_receiverId: { senderId: owner.id, receiverId: target.id } }
      })
      if (existing) return res.json({ token: '_frreqtwo_' })

      const friendsCount = await prisma.gameFriend.count({ where: { ownerId: owner.id } })
      if (friendsCount >= 50) return res.json({ token: '_addfrmax_' })

      await prisma.gameFriendReq.create({ data: { senderId: owner.id, receiverId: target.id } })
      return res.json({ token: '_frreqok_' })
    }

    // Aceitar pedido
    if (action === 'accept') {
      await prisma.gameFriend.createMany({
        data: [
          { ownerId: owner.id, targetId: target.id },
          { ownerId: target.id, targetId: owner.id },
        ],
        skipDuplicates: true
      })
      await prisma.gameFriendReq.deleteMany({
        where: { senderId: target.id, receiverId: owner.id }
      })
      return res.json({ token: '_addfrok_' })
    }

    // Remover amigo
    if (action === 'remove') {
      await prisma.gameFriend.deleteMany({
        where: {
          OR: [
            { ownerId: owner.id, targetId: target.id },
            { ownerId: target.id, targetId: owner.id },
          ]
        }
      })
      return res.json({ token: '_delfrndok_' })
    }
  }

  return res.status(405).end()
}
