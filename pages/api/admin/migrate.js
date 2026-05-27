// pages/api/admin/migrate.js
// Força criação das tabelas via prisma db push
// Acesse: /api/admin/migrate

import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).end()

  try {
    const { stdout, stderr } = await execAsync(
      'npx prisma db push --accept-data-loss --skip-generate',
      { timeout: 60000 }
    )

    return res.json({
      ok: true,
      stdout: stdout.slice(0, 2000),
      stderr: stderr.slice(0, 500),
    })
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: e.message,
      stdout: e.stdout?.slice(0, 2000),
      stderr: e.stderr?.slice(0, 500),
    })
  }
}
