// game-server/server.js
// Servidor UDP porta 7579 — compatível com 2D Strike 6.1.13
// Roda separado do Next.js: node game-server/server.js

const dgram  = require('dgram')
const fetch  = (...args) => import('node-fetch').then(m => m.default(...args))
require('dotenv').config({ path: '../.env' })

const PORT       = parseInt(process.env.GAME_UDP_PORT || '7579')
const API_BASE   = process.env.GAME_API_BASE || 'https://capdrawn.up.railway.app'
const GAME_KEY   = process.env.GAME_SERVER_KEY || 'change_me_secret'

const server = dgram.createSocket('udp4')

// ── Sessões ativas em memória ──────────────────────────────────────────────
// { "ip:port" : { username, rank, roomId, lastPing } }
const sessions = new Map()

function sessionKey(rinfo) { return `${rinfo.address}:${rinfo.port}` }

function send(msg, rinfo) {
  const buf = Buffer.from(msg, 'utf8')
  server.send(buf, rinfo.port, rinfo.address)
}

// ── Chamar API Next.js ─────────────────────────────────────────────────────
async function apiPost(path, body) {
  try {
    const r = await fetch(`${API_BASE}/api/game/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-game-key': GAME_KEY },
      body: JSON.stringify(body)
    })
    return await r.json()
  } catch (e) {
    console.error('API error:', e.message)
    return { token: '_error_' }
  }
}

async function apiGet(path, params) {
  try {
    const qs = new URLSearchParams(params).toString()
    const r  = await fetch(`${API_BASE}/api/game/${path}?${qs}`, {
      headers: { 'x-game-key': GAME_KEY }
    })
    return await r.json()
  } catch (e) {
    return { token: '_error_' }
  }
}

// ── Parser de pacotes ──────────────────────────────────────────────────────
// Protocolo: tokens separados por | ou espaço, ex: "REG|username|password"
function parsePacket(raw) {
  const str = raw.toString('utf8').trim()
  const parts = str.split('|')
  return { cmd: parts[0], args: parts.slice(1) }
}

// ── Handler principal ──────────────────────────────────────────────────────
server.on('message', async (msg, rinfo) => {
  const { cmd, args } = parsePacket(msg)
  const key = sessionKey(rinfo)

  console.log(`[UDP] ${key} → ${cmd} ${args.join(' ')}`)

  switch (cmd) {

    // ── Registro: REG|username|password ──────────────────────────────────
    case 'REG': {
      const [username, password] = args
      const data = await apiPost('register', { username, password })
      send(data.token, rinfo)
      break
    }

    // ── Login: LOGIN|username|password ────────────────────────────────────
    case 'LOGIN': {
      const [username, password] = args
      const data = await apiPost('login', { username, password })
      if (data.token === '_connloginok_') {
        sessions.set(key, { username, rank: data.rank, lastPing: Date.now() })
        // Envia token + info: _connloginok_|rank|kills|deaths|wins
        send(`${data.token}|${data.rank}|${data.kills}|${data.deaths}|${data.wins}`, rinfo)
      } else {
        send(data.token, rinfo)
      }
      break
    }

    // ── Login temporário (sem conta): TMPLOGIN|username ───────────────────
    case 'TMPLOGIN': {
      const [username] = args
      sessions.set(key, { username: username || `Guest_${Math.floor(Math.random()*9999)}`, rank: 'Low', lastPing: Date.now(), temporary: true })
      send('_conntmpok_', rinfo)
      break
    }

    // ── Pegar servidor de partida: GETSRV ─────────────────────────────────
    case 'GETSRV': {
      const data = await apiGet('rooms', {})
      if (!data.rooms || data.rooms.length === 0) {
        send('_nogr_', rinfo)
      } else {
        // Envia IP:porta do primeiro servidor disponível
        const room = data.rooms[0]
        send(`_getsrv_|${room.hostIp}|${room.hostPort}|${room.name}`, rinfo)
      }
      break
    }

    // ── Listar partidas: PARTLIST ─────────────────────────────────────────
    case 'PARTLIST': {
      const data = await apiGet('rooms', {})
      const list = (data.rooms || []).map(r => `${r.id}|${r.name}|${r.mapName}|${r.maxPlayers}`).join(';')
      send(`_partlist_|${list}`, rinfo)
      break
    }

    // ── Criar sala: ADDPART|name|mapName|maxPlayers ───────────────────────
    case 'ADDPART': {
      const [name, mapName, maxPlayers] = args
      const sess = sessions.get(key)
      const data = await apiPost('rooms', {
        name: name || 'Sala',
        mapName: mapName || 'default',
        maxPlayers: parseInt(maxPlayers) || 8,
        hostIp: rinfo.address,
        hostPort: rinfo.port
      })
      if (sess && data.roomId) sess.roomId = data.roomId
      send(data.token, rinfo)
      break
    }

    // ── Sair/fechar sala: DELPART ─────────────────────────────────────────
    case 'DELPART': {
      const sess = sessions.get(key)
      if (sess && sess.roomId) {
        const data = await apiPost('rooms', { roomId: sess.roomId, _method: 'DELETE' })
        send(data.token, rinfo)
      } else {
        send('_delpartok_', rinfo)
      }
      break
    }

    // ── Stats ao fim de partida: STATS|kills|deaths|won ───────────────────
    case 'STATS': {
      const sess = sessions.get(key)
      if (!sess || sess.temporary) { send('_screrror_', rinfo); break }
      const [kills, deaths, won] = args
      const data = await apiPost('stats', {
        username: sess.username,
        kills: parseInt(kills) || 0,
        deaths: parseInt(deaths) || 0,
        won: won === '1'
      })
      send(data.token, rinfo)
      break
    }

    // ── Lista de amigos: FRLIST ───────────────────────────────────────────
    case 'FRLIST': {
      const sess = sessions.get(key)
      if (!sess) { send('_connloginerror_', rinfo); break }
      const data = await apiGet('friends', { username: sess.username })
      const friendStr = (data.friends || []).map(f => `${f.username}|${f.rank}|${f.isOnline ? '1' : '0'}`).join(';')
      const reqStr    = (data.requests || []).join(';')
      send(`_frlist_|${friendStr}||_reqlist_|${reqStr}`, rinfo)
      break
    }

    // ── Pedido de amizade: FRREQ|targetUsername ───────────────────────────
    case 'FRREQ': {
      const sess = sessions.get(key)
      if (!sess) { send('_connloginerror_', rinfo); break }
      const data = await apiPost('friends', { action: 'request', username: sess.username, targetUsername: args[0] })
      send(data.token, rinfo)
      break
    }

    // ── Aceitar amizade: FRACPT|targetUsername ────────────────────────────
    case 'FRACPT': {
      const sess = sessions.get(key)
      if (!sess) { send('_connloginerror_', rinfo); break }
      const data = await apiPost('friends', { action: 'accept', username: sess.username, targetUsername: args[0] })
      send(data.token, rinfo)
      break
    }

    // ── Remover amigo: FRDEL|targetUsername ──────────────────────────────
    case 'FRDEL': {
      const sess = sessions.get(key)
      if (!sess) { send('_connloginerror_', rinfo); break }
      const data = await apiPost('friends', { action: 'remove', username: sess.username, targetUsername: args[0] })
      send(data.token, rinfo)
      break
    }

    // ── Ping / keepalive ──────────────────────────────────────────────────
    case 'PING': {
      const sess = sessions.get(key)
      if (sess) sess.lastPing = Date.now()
      send('PONG', rinfo)
      break
    }

    // ── Logout ────────────────────────────────────────────────────────────
    case 'QUIT': {
      sessions.delete(key)
      send('_null_', rinfo)
      break
    }

    default:
      console.log(`[UDP] Comando desconhecido: ${cmd}`)
      send('_null_', rinfo)
  }
})

// ── Limpar sessões inativas (> 2 min) ─────────────────────────────────────
setInterval(() => {
  const now = Date.now()
  for (const [key, sess] of sessions) {
    if (now - sess.lastPing > 120_000) {
      console.log(`[UDP] Sessão expirada: ${key} (${sess.username})`)
      sessions.delete(key)
    }
  }
}, 30_000)

server.on('listening', () => {
  const addr = server.address()
  console.log(`✅ 2D Strike UDP Server rodando em ${addr.address}:${addr.port}`)
  console.log(`   API Base: ${API_BASE}`)
})

server.on('error', (err) => {
  console.error('UDP Server erro:', err)
  server.close()
})

server.bind(PORT)
