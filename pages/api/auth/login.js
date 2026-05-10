import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

const prisma = new PrismaClient()

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { email, password } = req.body

  if (!email || !password)
    return res.status(400).json({ error: 'Email e senha obrigatórios' })

  if (!process.env.JWT_SECRET)
    return res.status(500).json({ error: 'Configuração do servidor incompleta' })

  // aceita "joao" ou "joao@capdrawn.com"
  const fullEmail = email.includes('@') ? email : `${email}@capdrawn.com`

  try {
    const user = await prisma.user.findUnique({ where: { email: fullEmail } })
    if (!user) return res.status(401).json({ error: 'Usuário não encontrado' })

    // Bloqueia contas offline (criadas automaticamente pelo sistema antigo)
    if (user.password === 'offline_user')
      return res.status(401).json({ error: 'Esta conta não tem senha definida. Crie uma conta completa.' })

    const ok = await bcrypt.compare(password, user.password)
    if (!ok) return res.status(401).json({ error: 'Senha incorreta' })

    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    )

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
    res.status(500).json({ error: 'Erro ao fazer login' })
  }
}
