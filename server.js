require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Conexão com PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ═══════════════════════════════
// ROTAS DA API
// ═══════════════════════════════

// ── USUÁRIOS ──

// Criar conta
app.post('/api/register', async (req, res) => {
  try {
    const { handle, name, password, descricao, cor, avatar, area } = req.body;
    const hash = await bcrypt.hash(password, 10);
    const joined = new Date().toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
    
    const result = await pool.query(
      `INSERT INTO users (handle, name, password_hash, descricao, cor, avatar, area, joined) 
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) 
       ON CONFLICT (handle) DO NOTHING RETURNING *`,
      [handle, name, hash, descricao, cor, avatar, area, joined]
    );
    
    if (result.rows.length === 0) {
      return res.json({ success: false, error: 'Handle já existe' });
    }
    
    const user = result.rows[0];
    res.json({ success: true, user: formatUser(user) });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// Login
app.post('/api/login', async (req, res) => {
  try {
    const { handle, password } = req.body;
    const result = await pool.query('SELECT * FROM users WHERE handle = $1', [handle]);
    
    if (result.rows.length === 0) {
      return res.json({ success: false, error: 'Usuário não encontrado' });
    }
    
    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    
    if (!valid) {
      return res.json({ success: false, error: 'Senha incorreta' });
    }
    
    res.json({ success: true, user: formatUser(user) });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// Buscar perfil
app.get('/api/user/:handle', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users WHERE handle = $1', [req.params.handle]);
    if (result.rows.length === 0) {
      return res.json({ success: false, error: 'Usuário não encontrado' });
    }
    
    const user = result.rows[0];
    const audioRes = await pool.query('SELECT * FROM videos WHERE handle = $1 ORDER BY created_at DESC LIMIT 20', [req.params.handle]);
    
    res.json({ success: true, user: formatUser(user, audioRes.rows) });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// Atualizar perfil
app.put('/api/user/:handle', async (req, res) => {
  try {
    const { name, descricao, cor, avatar, joined } = req.body;
    await pool.query(
      `UPDATE users SET name=$1, descricao=$2, cor=$3, avatar=$4, joined=$5 WHERE handle=$6`,
      [name, descricao, cor, avatar, joined, req.params.handle]
    );
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// Seguir/Deixar de seguir
app.post('/api/follow', async (req, res) => {
  try {
    const { follower, following } = req.body;
    const exists = await pool.query(
      'SELECT * FROM followers WHERE follower_handle=$1 AND following_handle=$2',
      [follower, following]
    );
    
    if (exists.rows.length > 0) {
      await pool.query('DELETE FROM followers WHERE follower_handle=$1 AND following_handle=$2', [follower, following]);
      await pool.query('UPDATE users SET followers = GREATEST(0, followers - 1) WHERE handle=$1', [following]);
      res.json({ success: true, following: false });
    } else {
      await pool.query('INSERT INTO followers (follower_handle, following_handle) VALUES ($1,$2)', [follower, following]);
      await pool.query('UPDATE users SET followers = followers + 1 WHERE handle=$1', [following]);
      res.json({ success: true, following: true });
    }
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// Verificar se segue
app.get('/api/isfollowing/:follower/:following', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM followers WHERE follower_handle=$1 AND following_handle=$2',
      [req.params.follower, req.params.following]
    );
    res.json({ following: result.rows.length > 0 });
  } catch (err) {
    res.json({ following: false });
  }
});

// ── COMENTÁRIOS ──

// Listar comentários
app.get('/api/comments', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.*, u.name, u.cor, u.avatar, u.vip, u.verified, u.official, u.area,
        (SELECT COUNT(*) FROM comment_likes WHERE comment_id = c.id) as total_likes
      FROM comments c
      JOIN users u ON c.handle = u.handle
      ORDER BY c.pinned DESC, c.created_at DESC
      LIMIT 50
    `);
    res.json({ success: true, comments: result.rows });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// Criar comentário
app.post('/api/comments', async (req, res) => {
  try {
    const { handle, texto, super_chat } = req.body;
    const result = await pool.query(
      'INSERT INTO comments (handle, texto, super_chat) VALUES ($1,$2,$3) RETURNING *',
      [handle, texto, super_chat || null]
    );
    await pool.query('UPDATE users SET comment_count = comment_count + 1 WHERE handle = $1', [handle]);
    
    const comment = result.rows[0];
    const userRes = await pool.query('SELECT * FROM users WHERE handle = $1', [handle]);
    comment.name = userRes.rows[0].name;
    comment.cor = userRes.rows[0].cor;
    comment.avatar = userRes.rows[0].avatar;
    comment.vip = userRes.rows[0].vip;
    comment.verified = userRes.rows[0].verified;
    
    res.json({ success: true, comment });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// Deletar comentário
app.delete('/api/comments/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM comments WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// Fixar/Desafixar comentário (ADM)
app.put('/api/comments/:id/pin', async (req, res) => {
  try {
    const { pinned } = req.body;
    if (pinned) {
      await pool.query('UPDATE comments SET pinned = FALSE');
    }
    await pool.query('UPDATE comments SET pinned = $1 WHERE id = $2', [pinned, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// Like comment
app.post('/api/comments/:id/like', async (req, res) => {
  try {
    const { handle } = req.body;
    const exists = await pool.query('SELECT * FROM comment_likes WHERE comment_id=$1 AND handle=$2', [req.params.id, handle]);
    
    if (exists.rows.length > 0) {
      await pool.query('DELETE FROM comment_likes WHERE comment_id=$1 AND handle=$2', [req.params.id, handle]);
      await pool.query('UPDATE comments SET likes = GREATEST(0, likes - 1) WHERE id=$1', [req.params.id]);
      res.json({ success: true, liked: false });
    } else {
      await pool.query('INSERT INTO comment_likes (comment_id, handle) VALUES ($1,$2)', [req.params.id, handle]);
      await pool.query('UPDATE comments SET likes = likes + 1 WHERE id=$1', [req.params.id]);
      res.json({ success: true, liked: true });
    }
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// ── CONFIGURAÇÕES ──

app.get('/api/settings', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM settings');
    const settings = {};
    result.rows.forEach(r => { settings[r.key] = r.value; });
    res.json({ success: true, settings });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

app.put('/api/settings/:key', async (req, res) => {
  try {
    await pool.query(
      'INSERT INTO settings (key, value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value=$2',
      [req.params.key, req.body.value]
    );
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// ── VÍDEOS ──

app.get('/api/videos', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT v.*, u.name, u.cor, u.avatar, u.vip, u.verified 
      FROM videos v 
      JOIN users u ON v.handle = u.handle 
      ORDER BY v.created_at DESC 
      LIMIT 30
    `);
    res.json({ success: true, videos: result.rows });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════
// SERVE O HTML PRINCIPAL
// ═══════════════════════════════

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ═══════════════════════════════
// INICIA SERVIDOR
// ═══════════════════════════════

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ CapDrawn rodando na porta ${PORT}`);
});

// Helper
function formatUser(u, videos = []) {
  return {
    handle: u.handle,
    name: u.name,
    descricao: u.descricao,
    cor: u.cor,
    avatar: u.avatar,
    area: u.area,
    joined: u.joined,
    followers: u.followers,
    audioCount: u.audio_count,
    commentCount: u.comment_count,
    vip: u.vip,
    vipTier: u.vip_tier,
    verified: u.verified,
    official: u.official,
    videos: videos
  };
}
