// pages/api/maintenance.js
// Salva e lê o estado de manutenção no banco de dados via uma tabela de settings
// Usa um arquivo JSON simples em /tmp para persistência (compatível com Railway sem migrations adicionais)

import { PrismaClient } from '@prisma/client'
import jwt from 'jsonwebtoken'
import fs from 'fs'
import path from 'path'

const globalForPrisma = globalThis
if (!globalForPrisma.prisma) globalForPrisma.prisma = new PrismaClient()
const prisma = globalForPrisma.prisma

const ADM_HANDLE = 'capdrawnOFC'
const STATE_FILE = '/tmp/capdrawn_maintenance.json'

function readState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))
    }
  } catch (e) {}
  return { active: false, message: '', until: null, updatedAt: null }
}

function writeState(state) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state), 'utf8')
  } catch (e) {}
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.json({ ok: true, ...readState() })
  }

  if (req.method === 'POST') {
    const authHeader = req.headers.authorization || ''
    const token = authHeader.replace('Bearer ', '').trim()
    if (!token) return res.status(401).json({ ok: false, error: 'Token obrigatório' })

    let userId
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET)
      userId = decoded.userId
    } catch {
      return res.status(401).json({ ok: false, error: 'Token inválido' })
    }

    // Verifica se é o ADM
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user || user.handle.toLowerCase() !== ADM_HANDLE.toLowerCase()) {
      return res.status(403).json({ ok: false, error: 'Acesso negado' })
    }

    const { active, message, until } = req.body
    const state = { active: !!active, message: message || '', until: until || null, updatedAt: new Date().toISOString() }
    writeState(state)
    return res.json({ ok: true, ...state })
  }

  return res.status(405).end()
}
