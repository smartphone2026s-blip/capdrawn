// pages/api/admin/setup-official.js
// Configura (e cria se necessário) a conta CapDrawnOFC como oficial:
// - isVerified = true
// - isVip = true
// - followers = 999999
// - bio e área de 2017
//
// Uso sem token  → cria a conta se não existir (primeiro acesso)
// Uso com token  → só pode ser chamado pela própria conta CapDrawnOFC
//
// POST /api/admin/setup-official
// Body (apenas quando criando pela 1ª vez): { "password": "SuaSenha" }

import bcrypt from 'bcryptjs'
import jwt    from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis
if (!globalForPrisma.prisma) globalForPrisma.prisma = new PrismaClient()
const prisma = globalForPrisma.prisma

const ADM_HANDLE = 'capdrawnOFC'
const ADM_EMAIL  = 'capdrawnOFC@capdrawn.com'

const ADM_DATA = {
  name:       'CapDrawn Oficial',
  isVerified: true,
  isVip:      true,
  followers:  999999,
  totalViews: 50000000,
  bio:        'Conta oficial da plataforma CapDrawn MemeShorts.\nFundada em 19 de dezembro de 2017.\n\n✅ Canal Verificado · ⭐ VIP · 🏆 Criador Original\n\nO maior feed de memes do Brasil.',
  area:       'criador',
  avatarUrl:  'https://api.dicebear.com/7.x/initials/svg?seed=CD&backgroundColor=6366f1&textColor=ffffff&fontSize=40&size=200',
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  // ── Se veio com token, valida que é o próprio ADM ──────────────────────────
  const authHeader = req.headers.authorization || ''
  const token = authHeader.replace('Bearer ', '').trim()

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET)
      const caller  = await prisma.user.findUnique({ where: { id: decoded.userId } })
      if (!caller || caller.handle.toLowerCase() !== ADM_HANDLE.toLowerCase()) {
        return res.status(403).json({ ok: false, error: 'Acesso negado' })
      }
    } catch {
      return res.status(401).json({ ok: false, error: 'Token inválido' })
    }
  }

  try {
    const existing = await prisma.user.findUnique({ where: { handle: ADM_HANDLE } })

    // ── Conta ainda não existe → cria agora ───────────────────────────────────
    if (!existing) {
      const { password } = req.body || {}

      if (!password || password.length < 6) {
        return res.status(400).json({
          ok: false,
          error: 'A conta ADM não existe ainda. Envie o campo "password" (mín. 6 caracteres) para criá-la.',
        })
      }

      const hashed = await bcrypt.hash(password, 10)

      const created = await prisma.user.create({
        data: {
          handle:   ADM_HANDLE,
          email:    ADM_EMAIL,
          password: hashed,
          ...ADM_DATA,
        }
      })

      // Gera token para já logar na sequência
      let loginToken = null
      if (process.env.JWT_SECRET) {
        loginToken = jwt.sign({ userId: created.id }, process.env.JWT_SECRET, { expiresIn: '30d' })
      }

      return res.status(201).json({
        ok:      true,
        created: true,
        message: 'Conta CapDrawnOFC criada e configurada com sucesso!',
        token:   loginToken,
        user: {
          handle:     created.handle,
          name:       created.name,
          email:      created.email,
          isVerified: created.isVerified,
          isVip:      created.isVip,
          followers:  created.followers,
        }
      })
    }

    // ── Conta já existe e já está configurada ─────────────────────────────────
    if (existing.isVerified && existing.isVip && existing.followers >= 999999) {
      return res.json({ ok: true, message: 'Conta já está configurada', already: true })
    }

    // ── Conta existe mas precisa ser atualizada ───────────────────────────────
    const updated = await prisma.user.update({
      where: { handle: ADM_HANDLE },
      data:  ADM_DATA,
    })

    return res.json({
      ok:      true,
      updated: true,
      message: 'Conta CapDrawnOFC configurada com sucesso!',
      user: {
        handle:     updated.handle,
        name:       updated.name,
        isVerified: updated.isVerified,
        isVip:      updated.isVip,
        followers:  updated.followers,
      }
    })

  } catch (e) {
    console.error('[setup-official]', e)
    return res.status(500).json({ ok: false, error: e.message })
  }
}
