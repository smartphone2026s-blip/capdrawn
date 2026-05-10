import { PrismaClient } from '@prisma/client'

// Singleton — evita múltiplas instâncias em hot-reload (dev) e no Railway (prod)
const globalForPrisma = globalThis

if (!globalForPrisma.prisma) {
  globalForPrisma.prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })
}

const prisma = globalForPrisma.prisma

export default prisma
