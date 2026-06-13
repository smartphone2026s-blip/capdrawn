// pages/api/game/rooms.js
// _getsrv_ / _partlist_ / _addpartok_ / _delpartok_

import prisma from '../../../lib/prisma'

export default async function handler(req, res) {
  const authKey = req.headers['x-game-key']
  if (authKey !== process.env.GAME_SERVER_KEY) {
    return res.status(401).json({ token: '_error_' })
  }

  // Listar salas abertas
  if (req.method === 'GET') {
    const rooms = await prisma.gameRoom.findMany({
      where: { isOpen: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })
    return res.json({ token: '_partlist_', rooms })
  }

  // Criar sala
  if (req.method === 'POST') {
    const { name, mapName, maxPlayers, hostIp, hostPort } = req.body
    try {
      const room = await prisma.gameRoom.create({
        data: { name, mapName, maxPlayers: maxPlayers || 8, hostIp, hostPort }
      })
      return res.json({ token: '_addpartok_', roomId: room.id })
    } catch (e) {
      return res.json({ token: '_error_' })
    }
  }

  // Fechar/sair de sala
  if (req.method === 'DELETE') {
    const { roomId } = req.body
    try {
      await prisma.gameRoom.update({
        where: { id: roomId },
        data: { isOpen: false }
      })
      return res.json({ token: '_delpartok_' })
    } catch (e) {
      return res.json({ token: '_delparterror_' })
    }
  }

  return res.status(405).end()
}
