import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { name, handle, email, password } = req.body

  if (!name || !handle || !email || !password)
    return res.status(400).json({ error: 'Todos os campos são obrigatórios' })

  if (password.length < 6)
    return res.status(400).json({ error: 'Senha deve ter ao menos 6 caracteres' })

  const fullEmail = email.includes('@') ? email : `${email}@capdrawn.com`

  try {
    const exists = await prisma.user.findFirst({
      where: { OR: [{ handle }, { email: fullEmail }] }
    })
    if (exists) return res.status(400).json({ error: 'Handle ou email já em uso' })

    const hashed = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({
      data: { name, handle, email: fullEmail, password: hashed }
    })

    res.json({ ok: true, user: { id: user.id, name: user.name, handle: user.handle } })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Erro ao criar conta' })
  }
}
