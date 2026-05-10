import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis
if (!globalForPrisma.prisma) {
  globalForPrisma.prisma = new PrismaClient()
}
const prisma = globalForPrisma.prisma

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  try {
    const { name, handle, email, password } = req.body

    if (!name || !handle || !email || !password)
      return res.status(400).json({ ok: false, error: 'Todos os campos são obrigatórios' })

    if (password.length < 6)
      return res.status(400).json({ ok: false, error: 'Senha deve ter ao menos 6 caracteres' })

    const handleClean = handle.toLowerCase().replace(/[^a-z0-9_]/g, '')
    if (handleClean.length < 3)
      return res.status(400).json({ ok: false, error: 'Handle deve ter ao menos 3 caracteres' })

    const fullEmail = email.includes('@') ? email : `${email}@capdrawn.com`

    const exists = await prisma.user.findFirst({
      where: { OR: [{ handle: handleClean }, { email: fullEmail }] }
    })

    if (exists) {
      if (exists.handle === handleClean)
        return res.status(400).json({ ok: false, error: 'Este @' + handleClean + ' já está em uso' })
      return res.status(400).json({ ok: false, error: 'Este email já está em uso' })
    }

    const hashed = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({
      data: {
        name,
        handle:   handleClean,
        email:    fullEmail,
        password: hashed,
      }
    })

    let token = null
    if (process.env.JWT_SECRET) {
      token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' })
    }

    res.json({
      ok: true,
      token,
      user: {
        id:         user.id,
        name:       user.name,
        handle:     user.handle,
        email:      user.email,
        avatarUrl:  user.avatarUrl,
        isVip:      user.isVip,
        isVerified: user.isVerified,
      }
    })
  } catch (e) {
    console.error('REGISTER ERROR:', e)
    // Retorna o erro real para o frontend ver
    const msg = e?.message || String(e)
    if (msg.includes('does not exist')) {
      return res.status(500).json({ ok: false, error: 'Banco de dados não inicializado. Aguarde o redeploy.' })
    }
    if (msg.includes('Unique constraint')) {
      return res.status(400).json({ ok: false, error: 'Email ou @handle já cadastrado' })
    }
    res.status(500).json({ ok: false, error: 'Erro interno: ' + msg.slice(0, 120) })
  }
}
