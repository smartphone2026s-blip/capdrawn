// pages/api/admin/setup-official.js
//
// Lógica:
// - Se a conta NÃO existe → cria com dados padrão (flags + followers/views iniciais)
// - Se a conta JÁ existe → aplica APENAS as flags (isVerified, isVip, area)
//   NÃO toca em: name, bio, avatarUrl, followers, totalViews
//   Seguidores/views são incrementados uma única vez se ainda estiverem zerados
//
// POST sem token  → cria a conta (primeira vez)
// POST com token  → só o próprio ADM pode chamar; apenas garante as flags

import bcrypt from 'bcryptjs'
import jwt    from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis
if (!globalForPrisma.prisma) globalForPrisma.prisma = new PrismaClient()
const prisma = globalForPrisma.prisma

const ADM_HANDLE = 'capdrawnOFC'
const ADM_EMAIL  = 'capdrawnOFC@capdrawn.com'

// Flags imutáveis — aplicadas sempre, mas nunca sobrescrevem dados editáveis
const ADM_FLAGS = {
  isVerified: true,
  isVip:      true,
  area:       'criador',
}

// Valores mínimos de followers/views — só aplicados se a conta estiver zerada
const ADM_MIN_FOLLOWERS  = 999999
const ADM_MIN_TOTALVIEWS = 50000000

// Dados padrão usados APENAS na criação inicial
const ADM_DEFAULTS = {
  name:      'CapDrawn Oficial',
  bio:       'Conta oficial da plataforma CapDrawn MemeShorts.\nFundada em 19 de dezembro de 2017.\n\n✅ Canal Verificado · ⭐ VIP · 🏆 Criador Original\n\nO maior feed de memes do Brasil.',
  avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=CD&backgroundColor=6366f1&textColor=ffffff&fontSize=40&size=200',
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  // Valida token se enviado (só o próprio ADM pode chamar com token)
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

    // ── Conta não existe → cria agora com tudo ────────────────────────────────
    if (!existing) {
      const { password } = req.body || {}
      if (!password || password.length < 6) {
        return res.status(400).json({
          ok: false,
          error: 'Conta ADM não existe. Envie "password" (mín. 6 chars) para criar.',
        })
      }

      const hashed = await bcrypt.hash(password, 10)
      const created = await prisma.user.create({
        data: {
          handle:     ADM_HANDLE,
          email:      ADM_EMAIL,
          password:   hashed,
          followers:  ADM_MIN_FOLLOWERS,
          totalViews: ADM_MIN_TOTALVIEWS,
          ...ADM_FLAGS,
          ...ADM_DEFAULTS,
        }
      })

      let loginToken = null
      if (process.env.JWT_SECRET) {
        loginToken = jwt.sign({ userId: created.id }, process.env.JWT_SECRET, { expiresIn: '30d' })
      }

      return res.status(201).json({
        ok: true, created: true,
        message: 'Conta CapDrawnOFC criada!',
        token: loginToken,
        user: { handle: created.handle, name: created.name, isVerified: created.isVerified, isVip: created.isVip },
      })
    }

    // ── Conta existe → aplica só as flags + incrementa followers/views se zerados
    // Nunca sobrescreve name, bio, avatarUrl, nem reduz followers/views existentes
    const updateData = { ...ADM_FLAGS }

    if ((existing.followers || 0) < ADM_MIN_FOLLOWERS) {
      updateData.followers = ADM_MIN_FOLLOWERS
    }
    if ((existing.totalViews || 0) < ADM_MIN_TOTALVIEWS) {
      updateData.totalViews = ADM_MIN_TOTALVIEWS
    }

    const updated = await prisma.user.update({
      where: { handle: ADM_HANDLE },
      data:  updateData,
    })

    return res.json({
      ok: true, updated: true,
      message: 'Flags ADM garantidas sem apagar dados do perfil.',
      user: {
        handle:     updated.handle,
        name:       updated.name,
        bio:        updated.bio,
        avatarUrl:  updated.avatarUrl,
        isVerified: updated.isVerified,
        isVip:      updated.isVip,
        followers:  updated.followers,
        totalViews: updated.totalViews,
      },
    })

  } catch (e) {
    console.error('[setup-official]', e)
    return res.status(500).json({ ok: false, error: e.message })
  }
}
