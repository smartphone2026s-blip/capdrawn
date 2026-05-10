import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

const prisma = new PrismaClient()

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { name, handle, email, password } = req.body

  if (!name || !handle || !email || !password)
    return res.status(400).json({ error: 'Todos os campos são obrigatórios' })

  if (password.length < 6)
    return res.status(400).json({ error: 'Senha deve ter ao menos 6 caracteres' })

  // handle: só letras, números e underscore, sem espaço
  const handleClean = handle.toLowerCase().replace(/[^a-z0-9_]/g, '')
  if (handleClean.length < 3)
    return res.status(400).json({ error: 'Handle deve ter ao menos 3 caracteres válidos' })

  // email: aceita "joao" → "joao@capdrawn.com" ou email completo externo
  const fullEmail = email.includes('@') ? email : `${email}@capdrawn.com`

  try {
    const exists = await prisma.user.findFirst({
      where: { OR: [{ handle: handleClean }, { email: fullEmail }] }
    })
    if (exists) {
      if (exists.handle === handleClean)
        return res.status(400).json({ error: 'Este @handle já está em uso' })
      return res.status(400).json({ error: 'Este email já está em uso' })
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

    // Faz login automático após criar conta
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
    console.error(e)
    res.status(500).json({ error: 'Erro ao criar conta' })
  }
}
