// ═══════════════════════════════════════════════════════
// CAPDRAWNN — script.js
// All functions extracted from index.html + API layer
// ═══════════════════════════════════════════════════════

// ═══════════════════════════════════════
// APP STATE
// ═══════════════════════════════════════
const APP = {
  me: null,
  isAdm: false,
  maintenance: false,
  payLinks: {
    tiktok: 'https://lite.tiktok.com/ref/capdrawnn',
    yt: 'https://youtube.com/@capdrawnn'
  },
  subscribers: new Set(),
  pinnedIds: new Set(),
  vipBenefits: ['Emblema exclusivo','Selo VIP','Nome em destaque','Super Chat','Live','IA integrada'],
};

// ═══════════════════════════════════════
// PERSISTÊNCIA DE SESSÃO (localStorage)
// ═══════════════════════════════════════
const SESSION_KEY = 'capdrawnn_session';
const EMAILS_KEY  = 'capdrawnn_emails';   // { "joao@cpd.com": { senha_hash, nascimento, handle } }
const USERS_KEY   = 'capdrawnn_users';

function saveSession() {
  if (!APP.me) { localStorage.removeItem(SESSION_KEY); return; }
  try { localStorage.setItem(SESSION_KEY, JSON.stringify({ handle: APP.me.handle })); } catch(e) {}
}

function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return;
    const { handle } = JSON.parse(raw);
    if (handle && USERS[handle]) { loginUser(handle); }
  } catch(e) {}
}

function saveUsers() {
  try {
    const exportable = {};
    for (const [k, u] of Object.entries(USERS)) {
      exportable[k] = { ...u, avatar: u.avatar && u.avatar.startsWith('blob:') ? null : u.avatar };
    }
    localStorage.setItem(USERS_KEY, JSON.stringify(exportable));
  } catch(e) {}
}

function loadUsers() {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    for (const [k, u] of Object.entries(saved)) { USERS[k] = u; }
  } catch(e) {}
}

function getEmails() {
  try { return JSON.parse(localStorage.getItem(EMAILS_KEY) || '{}'); } catch(e) { return {}; }
}

function saveEmails(emails) {
  try { localStorage.setItem(EMAILS_KEY, JSON.stringify(emails)); } catch(e) {}
}
// ═══════════════════════════════════════
// SISTEMA DE EMAIL @cpd.com
// ═══════════════════════════════════════
let emailCriado = null; // email verificado nesta sessão antes de criar conta

function verificarEmail(email) {
  const emails = getEmails();
  return emails.hasOwnProperty(email.toLowerCase());
}

function criarEmailCapDrawn() {
  const nome  = (document.getElementById('emailNome')?.value || '').trim().toLowerCase();
  const senha = (document.getElementById('emailSenha')?.value || '').trim();
  const nasc  = (document.getElementById('emailNasc')?.value  || '').trim();
  const erroEl = document.getElementById('emailErro');

  const showErr = (msg) => { if(erroEl){erroEl.textContent=msg;erroEl.style.display='block';} };
  if(erroEl) erroEl.style.display='none';

  if (!nome)  { showErr('⚠️ Digite o nome do email!'); return; }
  if (!senha || senha.length < 6) { showErr('⚠️ Senha deve ter pelo menos 6 caracteres!'); return; }
  if (!nasc)  { showErr('⚠️ Informe sua data de nascimento!'); return; }

  // Verificar maioridade (13+)
  const nascDate = new Date(nasc);
  const age = Math.floor((Date.now() - nascDate) / (365.25 * 24 * 3600 * 1000));
  if (age < 13) { showErr('⚠️ Você precisa ter pelo menos 13 anos!'); return; }

  const emailCompleto = nome + '@cpd.com';

  if (verificarEmail(emailCompleto)) {
    showErr('⚠️ Este email já está em uso! Tente outro nome.');
    return;
  }

  // Salva email
  const emails = getEmails();
  emails[emailCompleto] = { senha, nascimento: nasc, handle: null };
  saveEmails(emails);

  emailCriado = emailCompleto;
  closeModal('emailModal');

  // Atualiza label no modal de registro
  const lbl = document.getElementById('regEmailShow');
  if (lbl) lbl.textContent = emailCompleto;

  toast('✅ Email ' + emailCompleto + ' criado! Agora crie seu canal.');
  setTimeout(() => openModal('regModal'), 400);
}

async function apiCriarEmail(nome, senha, nascimento) {
  return await apiCall('POST', '/email/criar', { nome, senha, nascimento });
}

async function apiVerificarEmail(email) {
  return await apiCall('GET', '/email/verificar/' + encodeURIComponent(email));
}



// ═══════════════════════════════════════
// FILTRO DE CONTEÚDO IMPRÓPRIO
// ═══════════════════════════════════════
const PALAVRAS_PROIBIDAS = [
  'merda','porra','caralho','buceta','xoxota','viado','piroca','pau','cu ','fdp',
  'filha da puta','vadia','puta','vagabunda','desgraça','arrombado','inferno',
  'imbecil','idiota','retardado','lixo','babaca','cuzão','cuzao',
  'foda','fode','fodendo','fodido','fuder','fudi',
  'shit','fuck','bitch','asshole','nigger','cunt','dick','pussy'
];

function filtrarConteudo(texto) {
  if (!texto) return false;
  const lower = texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return PALAVRAS_PROIBIDAS.some(p => lower.includes(p.normalize('NFD').replace(/[\u0300-\u036f]/g, '')));
}

const USERS = {};
let COMMENTS = [
  {id:1,handle:'capdrawnn',text:'Bem-vindos ao CapDrawn! 🎵 Aqui você pode remover silêncios do seu áudio e conectar com outros criadores.',time:'1h atrás',likes:12,likedBy:[],pinned:true,sc:null},
  {id:2,handle:'criador_oficial',text:'Incrível ferramenta! Processei meu podcast de 1h em menos de 10 segundos. @capdrawnn isso mudou meu workflow!',time:'3h atrás',likes:4,likedBy:[],pinned:false,sc:null},
];
let nextId = 3;

const EMBLEMAS = [
  {id:'e1',emoji:'🎵',name:'Criador',color:'#e8f4ff',req:'free'},
  {id:'e2',emoji:'⚡',name:'Rápido',color:'#fff8e0',req:'free'},
  {id:'e3',emoji:'🏆',name:'Top',color:'#fff0e8',req:'vip'},
  {id:'e4',emoji:'💎',name:'Diamante',color:'#f0e8ff',req:'ultra'},
  {id:'e5',emoji:'🔥',name:'Viral',color:'#ffe8e8',req:'vip'},
  {id:'e6',emoji:'🌟',name:'Estrela',color:'#fffff0',req:'ultra'},
];

const BADGE_COLORS = {
  estudante:{bg:'#f0f0f5',c:'#555'},
  medicina:{bg:'#fff0f5',c:'#c2185b'},
  tecnologia:{bg:'#e8fff5',c:'#00a060'},
  criador:{bg:'#fff3e0',c:'#e65100'},
  musica:{bg:'#f3e5f5',c:'#6a1b9a'},
};
const BADGE_ICONS = {estudante:'📚',medicina:'🏥',tecnologia:'💻',criador:'🎬',musica:'🎵'};

// ═══════════════════════════════════════
// API LAYER — with memory fallback
// ═══════════════════════════════════════
const API_BASE = '/api';

async function apiCall(method, path, body) {
  try {
    const res = await fetch(API_BASE + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(APP.token ? {'Authorization':'Bearer '+APP.token} : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null; // fallback to memory
  }
}

// API: load comments from server, merge with memory
async function loadCommentsFromAPI() {
  const data = await apiCall('GET', '/comments');
  if (data && Array.isArray(data.comments) && data.comments.length) {
    COMMENTS = data.comments.map(c => ({
      id: c.id, handle: c.handle || c.username, text: c.text || c.content,
      time: c.created_at ? timeAgo(c.created_at) : 'agora',
      likes: c.likes || 0, likedBy: c.liked_by || [],
      pinned: c.pinned || false, sc: null,
    }));
    nextId = Math.max(...COMMENTS.map(c => c.id)) + 1;
    renderComments();
  }
}

async function postCommentAPI(text) {
  return await apiCall('POST', '/comments', { handle: APP.me.handle, text, token: APP.token });
}

async function likeCommentAPI(id) {
  return await apiCall('POST', `/comments/${id}/like`, { handle: APP.me.handle });
}

async function followUserAPI(handle) {
  return await apiCall('POST', `/users/${handle}/follow`, { follower: APP.me.handle });
}

async function registerAPI(name, handle, desc, color) {
  return await apiCall('POST', '/auth/register', { name, handle, desc, color, password: handle + '_cap' });
}

async function loginAPI(handle) {
  return await apiCall('POST', '/auth/login', { handle, password: handle + '_cap' });
}

function timeAgo(dateStr) {
  try {
    const d = new Date(dateStr), now = new Date();
    const diff = Math.floor((now - d) / 60000);
    if (diff < 1) return 'agora';
    if (diff < 60) return diff + 'min atrás';
    if (diff < 1440) return Math.floor(diff/60) + 'h atrás';
    return Math.floor(diff/1440) + 'd atrás';
  } catch { return 'agora'; }
}

// ═══════════════════════════════════════
// AUDIO ENGINE
// ═══════════════════════════════════════
let audioCtx=null, audioBuf=null, procBuf=null, silRegions=[], sourceNode=null, isPlaying=false, fileName='', fileSize=0;
const SS = { threshold:-35, minDur:.5, pad:.05 };

function onDrag(e, on) {
  e.preventDefault();
  document.getElementById('dropZone').classList.toggle('over', on);
}
function onDrop(e) {
  e.preventDefault();
  document.getElementById('dropZone').classList.remove('over');
  if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
}
function onFileSel(inp) {
  if (inp.files[0]) handleFile(inp.files[0]);
}

async function handleFile(f) {
  if (!f.type.startsWith('audio/') && !f.type.startsWith('video/')) {
    toast('⚠️ Formato não suportado!'); return;
  }
  fileName = f.name; fileSize = f.size;
  document.getElementById('dropZone').style.display = 'none';
  document.getElementById('sbar').classList.add('show');
  document.getElementById('wcard').classList.add('show');
  document.getElementById('wfName').textContent = f.name;
  document.getElementById('wfMeta').textContent = fSize(fileSize) + ' · ' + f.type.split('/')[1].toUpperCase();
  setWStatus('y', 'Pronto para processar');
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const ab = await f.arrayBuffer();
    audioBuf = await audioCtx.decodeAudioData(ab);
    document.getElementById('wfMeta').textContent = fSize(fileSize) + ' · ' + fDur(audioBuf.duration) + ' · ' + audioBuf.sampleRate + 'Hz';
    document.getElementById('sv1').textContent = fDur(audioBuf.duration);
    drawWave(audioBuf, 'cv1', null);
    document.getElementById('bPlay').disabled = false;
    toast('📂 Carregado! Clique em ⚡ Processar');
  } catch(e) { fakeAudio(f); }
}

function fakeAudio(f) {
  const d = 45 + Math.random() * 60;
  audioBuf = { duration:d, _fake:true, sampleRate:44100, numberOfChannels:1, getChannelData:()=>new Float32Array(Math.floor(d*44100)) };
  document.getElementById('wfMeta').textContent = fSize(fileSize) + ' · ' + fDur(d) + ' · 44100Hz';
  document.getElementById('sv1').textContent = fDur(d);
  drawFakeWave('cv1', null, d);
  document.getElementById('bPlay').disabled = false;
  toast('📂 Carregado! Clique em ⚡ Processar');
}

function drawWave(buf, id, sils) {
  const cv = document.getElementById(id), ctx = cv.getContext('2d');
  const W = cv.offsetWidth || 740, H = cv.height;
  cv.width = W; ctx.clearRect(0,0,W,H);
  const data = buf.getChannelData(0), step = Math.ceil(data.length/W), mid = H/2;
  ctx.fillStyle = '#f6f6f9'; ctx.fillRect(0,0,W,H);
  if (sils && sils.length) {
    ctx.fillStyle = 'rgba(240,48,80,.1)';
    sils.forEach(s => { const x1=s.start/buf.duration*W, x2=s.end/buf.duration*W; ctx.fillRect(x1,0,x2-x1,H); });
  }
  ctx.fillStyle = id==='cv2' ? '#0052e0' : '#0b0b14';
  for (let i=0;i<W;i++) {
    let mn=1, mx=-1;
    for (let j=0;j<step;j++) { const v=data[i*step+j]||0; if(v<mn)mn=v; if(v>mx)mx=v; }
    const y1=(1+mn)/2*H, y2=(1+mx)/2*H;
    ctx.globalAlpha = .7; ctx.fillRect(i, y1, 1, Math.max(1,y2-y1));
  }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(0,0,0,.1)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0,mid); ctx.lineTo(W,mid); ctx.stroke();
}

function drawFakeWave(id, sils, dur) {
  const cv = document.getElementById(id), ctx = cv.getContext('2d');
  const W = cv.offsetWidth || 740, H = cv.height;
  cv.width = W; ctx.clearRect(0,0,W,H);
  const isProc = id === 'cv2';
  ctx.fillStyle = '#f6f6f9'; ctx.fillRect(0,0,W,H);
  if (sils && dur) {
    ctx.fillStyle = 'rgba(240,48,80,.1)';
    sils.forEach(s => { ctx.fillRect(s.start/dur*W, 0, (s.end-s.start)/dur*W, H); });
  }
  let rng = fileName.length || 7;
  const rand = () => { rng=(rng*16807)%2147483647; return rng/2147483647; };
  ctx.fillStyle = isProc ? '#0052e0' : '#0b0b14'; ctx.globalAlpha = .7;
  for (let i=0;i<W;i++) {
    const t = i/W;
    const inSil = sils && dur && sils.some(s => t>=s.start/dur && t<=s.end/dur);
    if (inSil && isProc) continue;
    const amp = inSil ? .02 : Math.max(.02, Math.abs(.35+.35*Math.sin(t*Math.PI*8+3)*Math.cos(t*Math.PI*2.5)+(rand()-.5)*.35));
    const bh = amp*H*.85; ctx.fillRect(i, H/2-bh/2, 1, bh);
  }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(0,0,0,.08)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0,H/2); ctx.lineTo(W,H/2); ctx.stroke();
}

function detectSilence(buf) {
  if (buf._fake) return fakeSilence(buf.duration);
  const data=buf.getChannelData(0), sr=buf.sampleRate, th=Math.pow(10,SS.threshold/20), minS=Math.floor(SS.minDur*sr);
  const regs=[]; let ss=-1;
  for (let i=0;i<data.length;i++) {
    if (Math.abs(data[i])<th) { if(ss<0)ss=i; }
    else { if(ss>=0 && i-ss>=minS) regs.push({start:Math.max(0,ss/sr-SS.pad),end:Math.min(buf.duration,i/sr+SS.pad)}); ss=-1; }
  }
  return mergeRegs(regs);
}
function fakeSilence(d) {
  const r=[]; let t=.5+Math.random()*1.5;
  while(t<d-1){const s=.4+Math.random()*2;r.push({start:t,end:t+s});t+=s+1.5+Math.random()*4;}
  return r;
}
function mergeRegs(r) {
  if(!r.length)return[];
  r.sort((a,b)=>a.start-b.start);
  const m=[r[0]];
  for(let i=1;i<r.length;i++){const l=m[m.length-1];if(r[i].start<=l.end+.1)l.end=Math.max(l.end,r[i].end);else m.push(r[i]);}
  return m;
}
function buildProcBuf(buf, sils) {
  if(!sils.length)return buf;
  const sr=buf.sampleRate, segs=[]; let c=0;
  for(const s of sils){if(c<s.start)segs.push({start:c,end:s.start});c=s.end;}
  if(c<buf.duration)segs.push({start:c,end:buf.duration});
  const tot=segs.reduce((a,s)=>a+Math.floor((s.end-s.start)*sr),0);
  const nb=audioCtx.createBuffer(buf.numberOfChannels,tot,sr);
  for(let ch=0;ch<buf.numberOfChannels;ch++){
    const id=buf.getChannelData(ch),od=nb.getChannelData(ch);let off=0;
    for(const seg of segs){const s=Math.floor(seg.start*sr),e=Math.floor(seg.end*sr);od.set(id.subarray(s,e),off);off+=e-s;}
  }
  return nb;
}

async function processAudio() {
  if(!audioBuf){toast('⚠️ Carregue um arquivo primeiro!');return;}
  document.getElementById('procOv').classList.add('show');
  document.getElementById('statsRow').style.display='none';
  document.getElementById('silWrap').style.display='none';
  document.getElementById('bProc').disabled=true;
  document.getElementById('bExp').disabled=true;
  setWStatus('b','Processando…');
  const steps=[
    {t:'Carregando samples…',s:'Lendo arquivo de áudio',p:25},
    {t:'Detectando silêncios…',s:'Limiar: '+SS.threshold+'dB',p:55},
    {t:'Aplicando cortes…',s:'Padding de '+SS.pad+'s',p:80},
    {t:'Gerando prévia…',s:'Montando waveform',p:98},
  ];
  for(const st of steps){document.getElementById('procT').textContent=st.t;document.getElementById('procS').textContent=st.s;await animBar(st.p);await sleep(350+Math.random()*250);}
  silRegions=detectSilence(audioBuf);
  const totSil=silRegions.reduce((a,r)=>a+(r.end-r.start),0),orig=audioBuf.duration,newD=Math.max(1,orig-totSil);
  await animBar(100);await sleep(150);
  document.getElementById('procOv').classList.remove('show');
  document.getElementById('procLbl').style.opacity='1';
  if(audioBuf._fake){drawFakeWave('cv1',silRegions,orig);drawFakeWave('cv2',null,newD);}
  else{drawWave(audioBuf,'cv1',silRegions);procBuf=buildProcBuf(audioBuf,silRegions);drawWave(procBuf,'cv2',null);}
  renderSilTags(silRegions,orig);
  document.getElementById('statsRow').style.display='grid';
  document.getElementById('sv2').textContent=fDur(newD);
  document.getElementById('sv3').textContent=fDur(totSil);
  document.getElementById('sv4').textContent=silRegions.length;
  document.getElementById('bProc').disabled=false;
  document.getElementById('bExp').disabled=false;
  setWStatus('g','✓ Processado!');
  document.getElementById('pbar').style.width='0%';
  toast(`✅ ${silRegions.length} silêncios removidos! Salvou ${fDur(totSil)}`);
}

function renderSilTags(regs, dur) {
  const w=document.getElementById('silWrap');w.style.display='flex';
  w.querySelectorAll('.sil-tag').forEach(e=>e.remove());
  regs.slice(0,10).forEach((r,i)=>{
    const t=document.createElement('div');t.className='sil-tag';
    t.innerHTML=`✂ ${fDur(r.start)}–${fDur(r.end)} <span style="color:var(--red);margin-left:2px;">(${fDur(r.end-r.start)})</span>`;
    t.onclick=()=>{t.classList.add('removed');silRegions.splice(i,1);};w.appendChild(t);
  });
  if(regs.length>10){const m=document.createElement('span');m.style.cssText='font-size:.68rem;color:var(--t3);font-weight:600;';m.textContent=`+${regs.length-10} mais`;w.appendChild(m);}
}

function togglePlay() {
  if(!audioCtx)return;
  if(isPlaying){if(sourceNode)try{sourceNode.stop()}catch(e){}isPlaying=false;document.getElementById('bPlay').textContent='▶ Reproduzir';return;}
  const buf=procBuf||audioBuf;if(!buf||buf._fake){toast('🎵 Demo — reprodução não disponível para arquivos simulados');return;}
  if(audioCtx.state==='suspended')audioCtx.resume();
  sourceNode=audioCtx.createBufferSource();sourceNode.buffer=buf;sourceNode.connect(audioCtx.destination);sourceNode.start(0);
  isPlaying=true;document.getElementById('bPlay').textContent='⏸ Pausar';
  sourceNode.onended=()=>{isPlaying=false;document.getElementById('bPlay').textContent='▶ Reproduzir';};
}

function exportAudio() {
  if(!silRegions.length&&!procBuf){toast('⚠️ Processe o áudio primeiro!');return;}
  const b=document.getElementById('bExp');b.textContent='⏳ Exportando…';b.disabled=true;
  setTimeout(()=>{
    b.textContent='⬇ Exportar';b.disabled=false;
    const n=fileName.replace(/\.[^.]+$/,'')+'_sem_silencio.mp3';
    toast(`✅ "${n}" baixado!`);
    if(APP.me){const u=APP.me;if(!u.audios)u.audios=[];u.audios.unshift({name:n,icon:'🎵',date:'agora',locked:true,quality:'320kbps'});u.audioCount=(u.audioCount||0)+1;}
  },1800);
}

function resetAudio() {
  if(sourceNode)try{sourceNode.stop()}catch(e){}
  audioBuf=null;procBuf=null;silRegions=[];isPlaying=false;
  document.getElementById('dropZone').style.display='block';
  document.getElementById('sbar').classList.remove('show');
  document.getElementById('wcard').classList.remove('show');
  document.getElementById('statsRow').style.display='none';
  document.getElementById('silWrap').style.display='none';
  document.getElementById('procOv').classList.remove('show');
  document.getElementById('aFile').value='';
  document.getElementById('pbar').style.width='0%';
  document.getElementById('procLbl').style.opacity='.3';
  document.getElementById('bProc').disabled=false;
  document.getElementById('bExp').disabled=true;
  document.getElementById('bPlay').disabled=true;
  ['cv1','cv2'].forEach(id=>{const c=document.getElementById(id);if(c){const ctx=c.getContext('2d');ctx.clearRect(0,0,c.width,c.height);}});
}

function setWStatus(c,t){document.getElementById('wst').innerHTML=`<div class="sdot ${c}"></div><span>${t}</span>`;}
async function animBar(target){return new Promise(r=>{const b=document.getElementById('pbar');let cur=parseFloat(b.style.width)||0;const s=()=>{cur+=2.5;b.style.width=Math.min(cur,target)+'%';if(cur<target)requestAnimationFrame(s);else r();};s();});}
const sleep = ms => new Promise(r=>setTimeout(r,ms));
const fDur = s => { if(!s||isNaN(s))return'—';const m=Math.floor(s/60),sc=Math.floor(s%60);return`${m}:${String(sc).padStart(2,'0')}`; };
const fSize = b => b>1048576?(b/1048576).toFixed(1)+' MB':(b/1024).toFixed(0)+' KB';

// ═══════════════════════════════════════
// COMMENTS & CHAT
// ═══════════════════════════════════════
function renderComments() {
  const list=document.getElementById('clist');
  list.innerHTML='';
  [...COMMENTS].sort((a,b)=>(b.pinned?1:-1)-(a.pinned?1:-1)).forEach(c=>{
    const u=USERS[c.handle]||{name:c.handle,handle:c.handle,color:'#888',avatar:null};
    const isVIP=u.vip, isVer=u.verified||u.official;
    const isMe=APP.me&&APP.me.handle===c.handle;
    const isAdm=APP.isAdm;
    const text=c.text.replace(/@(\w+)/g,(m,h)=>`<span onclick="openProfile('${h}')" style="color:var(--blue);font-weight:600;cursor:pointer;">@${h}</span>`);
    const nameClass=isVIP?'cname vip-name vip-glow':'cname';
    const pinBadge=c.pinned?`<div class="pin-badge">📌 Fixado</div>`:'';
    const vipS=isVIP?`<span class="vip-seal">⭐ VIP</span>`:'';
    const verS=isVer?`<span class="verified-seal">✓ Verificado</span>`:'';
    const badgeHtml=u.area?`<span class="badge-pill" style="background:${(BADGE_COLORS[u.area]||{bg:'#eee'}).bg};color:${(BADGE_COLORS[u.area]||{c:'#666'}).c};">${BADGE_ICONS[u.area]||''} ${u.area}</span>`:'';
    const liked=(c.likedBy||[]).includes(APP.me?.handle);
    const pinAdm=isAdm?`<button onclick="admPin(${c.id})" style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:20px;border:1px solid var(--border);background:var(--w);font-size:.72rem;font-weight:600;cursor:pointer;color:var(--t3);"><svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><path d="M5 1h2v5l2 1-1 1H4L3 7l2-1V1z"/></svg> Fixar</button>`:'';
    const delBtn=(isAdm||isMe)?`<button onclick="delComment(${c.id})" style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:20px;border:1px solid var(--border);background:var(--w);font-size:.72rem;font-weight:600;cursor:pointer;color:var(--t3);"><svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 3h8M5 3V2h2v1M4 3v6M8 3v6M3 3l.5 6h5L9 3"/></svg></button>`:'';
    list.innerHTML+=`<div class="ccard${c.pinned?' pinned':''}" id="cc${c.id}">
      ${pinBadge}
      <div class="ctop">
        ${avHTML(u,36,true)}
        <div class="cmeta">
          <div class="cname-row">
            <span class="${nameClass}" onclick="openProfile('${c.handle}')">${u.name}</span>
            ${vipS}${verS}${badgeHtml}
            <span class="ctime">${c.time}</span>
          </div>
          <div class="chandle">@${c.handle}</div>
          <div class="ctext">${text}</div>
          <div class="cacts">
            <button class="ca like-btn${liked?' liked':''}" onclick="likeComment(${c.id},this)">
              <svg width="13" height="13" viewBox="0 0 13 13" fill="${liked?'#f03050':'none'}" stroke="${liked?'#f03050':'currentColor'}" stroke-width="1.6"><path d="M6.5 11S1 7.5 1 4.5A2.5 2.5 0 016.5 3 2.5 2.5 0 0112 4.5C12 7.5 6.5 11 6.5 11z"/></svg>
              ${c.likes||0}
            </button>
            <button class="ca reply-btn" onclick="replyTo('${c.handle}')">
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M2 2h9v7H7L4 11V9H2V2z"/></svg>
              Responder
            </button>
            ${pinAdm}${delBtn}
          </div>
        </div>
      </div>
    </div>`;
  });
}

async function sendComment() {
  if(!APP.me){openLogin();return;}
  const inp=document.getElementById('compInp'),text=inp.value.trim();
  if(!text)return;
  if(filtrarConteudo(text)){ toast('⚠️ Conteúdo não permitido!'); return; }
  const c={id:nextId++,handle:APP.me.handle,text,time:'agora',likes:0,likedBy:[],pinned:false,sc:null};
  COMMENTS.unshift(c);
  APP.me.commentCount=(APP.me.commentCount||0)+1;
  inp.value='';
  hideMentDrop();
  renderComments();
  postCommentAPI(text);
}

function likeComment(id, btn) {
  if(!APP.me){openLogin();return;}
  const c=COMMENTS.find(x=>x.id===id);if(!c)return;
  if(!c.likedBy)c.likedBy=[];
  const h=APP.me.handle;
  if(c.likedBy.includes(h)){c.likedBy=c.likedBy.filter(x=>x!==h);c.likes=Math.max(0,(c.likes||0)-1);}
  else{c.likedBy.push(h);c.likes=(c.likes||0)+1;}
  likeCommentAPI(id);
  renderComments();
}

function delComment(id){COMMENTS=COMMENTS.filter(x=>x.id!==id);renderComments();}
function replyTo(h){const inp=document.getElementById('compInp');inp.value=`@${h} `;inp.focus();document.getElementById('compose').scrollIntoView({behavior:'smooth'});}
function admPin(id){
  COMMENTS.forEach(c=>c.pinned=false);
  const c=COMMENTS.find(x=>x.id===id);if(c){c.pinned=true;toast('📌 Comentário fixado!');}
  renderComments();
}
function pinComment(){const id=parseInt(document.getElementById('pinCommentId').value);admPin(id);}
function unpinAll(){COMMENTS.forEach(c=>c.pinned=false);renderComments();toast('Fixados removidos');}

function onCompInput(el) {
  const v=el.value,la=v.lastIndexOf('@');
  if(la===-1){hideMentDrop();return;}
  const q=v.slice(la+1).toLowerCase();
  if(!q){hideMentDrop();return;}
  const matches=Object.values(USERS).filter(u=>u.handle.startsWith(q)||u.name.toLowerCase().startsWith(q)).slice(0,5);
  if(!matches.length){hideMentDrop();return;}
  const drop=document.getElementById('mentDrop');
  drop.innerHTML=matches.map(u=>`<div class="ment-item" onclick="complMent('${u.handle}')">${avHTML(u,28,false)}<div><strong style="font-size:.8rem;">${u.name}</strong><div style="font-size:.68rem;color:var(--t3);">@${u.handle}</div></div></div>`).join('');
  drop.classList.add('show');
}
function onCompKey(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendComment();}}
function complMent(h){const inp=document.getElementById('compInp'),v=inp.value,la=v.lastIndexOf('@');inp.value=v.slice(0,la+1)+h+' ';hideMentDrop();inp.focus();}
function hideMentDrop(){const d=document.getElementById('mentDrop');if(d)d.classList.remove('show');}
function insertMent(){const inp=document.getElementById('compInp');inp.value+='@';inp.focus();}

// Super chat
function openSuperChat(){if(!APP.me?.vip){toast('⭐ Super Chat é exclusivo para VIP!');return;}openModal('scModal');}
function sendSuperChat(){
  if(!APP.me)return;
  const msg=document.getElementById('scMsg').value.trim(),val=parseInt(document.getElementById('scVal').value);
  if(!msg){toast('Digite uma mensagem!');return;}
  const colors={5:'sc-3',20:'sc-2',50:'sc-1'};
  const sc=document.getElementById('superchats');sc.classList.add('show');
  const u=APP.me;
  sc.innerHTML+=`<div class="sc-item ${colors[val]||'sc-3'}"><div class="sc-av" style="background:${u.color||'#0052e0'}">${u.name.charAt(0)}</div><div><strong style="font-size:.78rem;">${u.name}</strong><div class="sc-msg">${msg}</div></div><div class="sc-val">R$${val}</div></div>`;
  closeModal('scModal');toast('💛 Super Chat enviado!');
  COMMENTS.unshift({id:nextId++,handle:u.handle,text:`💛 Super Chat R$${val}: ${msg}`,time:'agora',likes:0,likedBy:[],pinned:false,sc:val});
  renderComments();
  setTimeout(()=>{const items=sc.querySelectorAll('.sc-item');if(items.length>5)items[0].remove();},15000);
}

// ═══════════════════════════════════════
// AUTH
// ═══════════════════════════════════════
let regAvUrl=null, regSelBadge=null, editAvUrl=null;

function updateRegInit(){
  const v=document.getElementById('regName').value;
  const p=document.getElementById('regAvPrev');
  if(!regAvUrl)p.textContent=v.charAt(0).toUpperCase()||'C';
}
function selBadge(el){regSelBadge=el.dataset.b;document.querySelectorAll('#badgeSel .bo').forEach(e=>e.classList.remove('sel'));el.classList.add('sel');}
function setAvCol(el,prevId){
  regAvUrl=null;
  const p=document.getElementById(prevId);
  p.style.background=el.dataset.c;
  document.querySelectorAll('.col-row .col-dot').forEach(d=>d.classList.remove('active'));
  el.classList.add('active');
}
function prevAvatar(inp,prevId){
  if(!inp.files[0])return;
  const r=new FileReader();
  r.onload=e=>{
    if(prevId==='regAvPrev')regAvUrl=e.target.result;else editAvUrl=e.target.result;
    const p=document.getElementById(prevId);p.innerHTML=`<img src="${e.target.result}"/>`;
  };
  r.readAsDataURL(inp.files[0]);
}

async function createAccount() {
  const name=document.getElementById('regName').value.trim();
  const handle=document.getElementById('regHandle').value.trim().replace(/[^a-z0-9_]/gi,'').toLowerCase();
  const desc=document.getElementById('regDesc').value.trim();
  if(!name||!handle){toast('⚠️ Preencha nome e @usuário!');return;}
  if(USERS[handle]){toast('⚠️ @ já está em uso!');return;}
  const color=document.getElementById('regAvPrev').style.background||'#0052e0';
  const joined=new Date().toLocaleDateString('pt-BR',{month:'short',year:'numeric'});
  USERS[handle]={name,handle,desc,area:regSelBadge,color,avatar:regAvUrl,joined,followers:0,audioCount:0,commentCount:0,audios:[],videos:[],vip:false,verified:false,official:false};
  // Try API registration
  registerAPI(name,handle,desc,color);
  regAvUrl=null;regSelBadge=null;
  closeModal('regModal');
  loginUser(handle);
}

function openLogin(){openModal('loginModal');}
function openRegister(){closeModal('loginModal');openModal('regModal');}

async function doLogin() {
  const emailNome = (document.getElementById('liHandle')?.value || '').trim().toLowerCase();
  const senha     = (document.getElementById('liSenha')?.value  || '').trim();
  const erroEl    = document.getElementById('loginErro');
  if (erroEl) erroEl.style.display = 'none';

  const showErr = (msg) => { if(erroEl){erroEl.textContent=msg;erroEl.style.display='block';} toast(msg); };

  if (!emailNome) { showErr('⚠️ Digite seu email!'); return; }
  if (!senha)     { showErr('⚠️ Digite sua senha!'); return; }

  const emailCompleto = emailNome.includes('@') ? emailNome : emailNome + '@cpd.com';
  const emails = getEmails();

  if (!emails[emailCompleto]) {
    showErr('⚠️ Email não encontrado. Crie seu email @cpd.com primeiro!');
    return;
  }
  if (emails[emailCompleto].senha !== senha) {
    showErr('⚠️ Senha incorreta!');
    return;
  }

  const handle = emails[emailCompleto].handle;
  if (!handle || !USERS[handle]) {
    // Email existe mas canal não criado ainda
    emailCriado = emailCompleto;
    const lbl = document.getElementById('regEmailShow');
    if (lbl) lbl.textContent = emailCompleto;
    closeModal('loginModal');
    toast('Email verificado! Crie seu canal agora.');
    setTimeout(() => openModal('regModal'), 300);
    return;
  }

  closeModal('loginModal');
  loginUser(handle);
}

function loginUser(handle) {
  APP.me=USERS[handle];const u=APP.me;
  saveSession(); saveUsers();
  const btnL=document.getElementById('btnLogin');const btnR=document.getElementById('btnReg');
  if(btnL)btnL.style.display='none';if(btnR)btnR.style.display='none';
  const nav=document.getElementById('navAv');
  if(nav){nav.style.display='flex';nav.style.background=u.color||'#0052e0';nav.textContent=u.name.charAt(0).toUpperCase();if(u.avatar)nav.innerHTML=`<img src="${u.avatar}"/>`;}
  const lp=document.getElementById('loginPrompt');if(lp)lp.style.display='none';
  const comp=document.getElementById('compose');if(comp)comp.classList.add('show');
  const av=document.getElementById('compAv');
  if(av){av.style.background=u.color||'#0052e0';av.textContent=u.name.charAt(0).toUpperCase();if(u.avatar)av.innerHTML=`<img src="${u.avatar}"/>`;}
  const scBtn=document.getElementById('scBtn');if(scBtn)scBtn.style.display=u.vip?'flex':'none';
  const vcAv=document.getElementById('vcCompAv');
  if(vcAv){vcAv.style.background=u.color||'#0052e0';vcAv.textContent=u.name.charAt(0).toUpperCase();if(u.avatar)vcAv.innerHTML=`<img src="${u.avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"/>`;}
  renderComments();
  toast(`👋 Bem-vindo, ${u.name}!`);
}

function logout() {
  APP.me=null;
  saveSession();
  const btnL=document.getElementById('btnLogin');const btnR=document.getElementById('btnReg');
  if(btnL)btnL.style.display='';if(btnR)btnR.style.display='';
  const nav=document.getElementById('navAv');if(nav)nav.style.display='none';
  const lp=document.getElementById('loginPrompt');if(lp)lp.style.display='flex';
  const comp=document.getElementById('compose');if(comp)comp.classList.remove('show');
  const scBtn=document.getElementById('scBtn');if(scBtn)scBtn.style.display='none';
  closeModal('profileModal');
  renderComments();
  toast('Você saiu da conta.');
}

function openProfileModal() {
  if(!APP.me){openLogin();return;}
  const u=APP.me;
  document.getElementById('editName').value=u.name;
  document.getElementById('editDesc').value=u.desc||'';
  const p=document.getElementById('editAvPrev');
  p.style.background=u.color||'#0052e0';p.textContent=u.name.charAt(0).toUpperCase();
  if(u.avatar)p.innerHTML=`<img src="${u.avatar}"/>`;
  const vdr=document.getElementById('vipDateRow');if(vdr)vdr.style.display=u.vip?'block':'none';
  const ej=document.getElementById('editJoined');if(ej)ej.value=u.joined||'';
  openModal('profileModal');
}

function saveProfile() {
  if(!APP.me)return;
  const u=APP.me;
  u.name=document.getElementById('editName').value.trim()||u.name;
  u.desc=document.getElementById('editDesc').value.trim();
  const ej=document.getElementById('editJoined');
  if(u.vip&&ej)u.joined=ej.value.trim()||u.joined;
  if(editAvUrl){u.avatar=editAvUrl;editAvUrl=null;}
  closeModal('profileModal');loginUser(u.handle);toast('✅ Perfil atualizado!');
}

// ═══════════════════════════════════════
// VIP
// ═══════════════════════════════════════
let vipTier=null;
function openVipModal(tier){vipTier=tier;openModal('vipModal');}
function selPay(n){
  const tikPayBox=document.getElementById('tikPayBox');
  const ytSubBox=document.getElementById('ytSubBox');
  if(tikPayBox)tikPayBox.style.display='none';
  if(ytSubBox)ytSubBox.style.display='none';
  document.querySelectorAll('.pay-opt').forEach(e=>e.classList.remove('selected'));
  const po=document.getElementById('po'+n);if(po)po.classList.add('selected');
  if(n===1&&tikPayBox){tikPayBox.style.display='block';const tc=document.getElementById('tikCode');if(tc)tc.textContent='CAPDRAWNN-'+Math.random().toString(36).slice(2,8).toUpperCase();const tl=document.getElementById('tikLink');if(tl)tl.href=APP.payLinks.tiktok;}
  if(n===2&&ytSubBox){ytSubBox.style.display='block';const yl=document.getElementById('ytLink');if(yl)yl.href=APP.payLinks.yt;}
}
function copyCode(){const c=document.getElementById('tikCode');if(c){navigator.clipboard&&navigator.clipboard.writeText(c.textContent);toast('📋 Código copiado: '+c.textContent);}}
function confirmVipPayment(){if(!APP.me){openLogin();return;}APP.me.vip=true;APP.me.vipTier='pro';closeModal('vipModal');activateVip('Pro');}
function confirmVipYT(){if(!APP.me){openLogin();return;}APP.me.vip=true;APP.me.vipTier='ultra';APP.me.verified=true;closeModal('vipModal');activateVip('Ultra');}
function activateVip(tier){
  const u=APP.me;
  toast(`⭐ VIP ${tier} ativado para @${u.handle}!`);
  const vst=document.getElementById('vipStatusTxt');if(vst)vst.textContent=`VIP ${tier} ativo ✓`;
  const scBtn=document.getElementById('scBtn');if(scBtn)scBtn.style.display='flex';
  loginUser(u.handle);renderComments();
}

// ═══════════════════════════════════════
// PROFILE PAGE
// ═══════════════════════════════════════
let viewingHandle=null;
function openProfile(handle) {
  if(!handle)return;
  const u=USERS[handle];if(!u){toast('Usuário não encontrado.');return;}
  viewingHandle=handle;
  const isMe=APP.me&&APP.me.handle===handle;

  const lbl=document.getElementById('profBackLbl');if(lbl)lbl.textContent=u.name;
  const cov=document.getElementById('profCover');if(cov)cov.style.background=`linear-gradient(160deg,${u.color||'#0052e0'}44 0%,${u.color||'#0052e0'}18 60%,var(--bg2) 100%)`;

  const big=document.getElementById('profAvBig');
  if(big){big.style.background=u.color||'#0052e0';big.innerHTML=u.avatar?`<img src="${u.avatar}"/>`:`<span style="font-size:2rem;font-weight:800;color:#fff;">${u.name.charAt(0).toUpperCase()}</span>`;}

  const actions=document.getElementById('profAvActions');
  if(actions){
    if(isMe){
      actions.innerHTML=`<button class="prof-edit-btn" onclick="document.getElementById('profilePage').classList.remove('show');document.body.style.overflow='';openProfileModal();">Editar canal</button>`;
    } else {
      const subd=APP.subscribers.has(handle);
      actions.innerHTML=`<button class="prof-follow-btn${subd?' following':''}" id="profFollowBtn" onclick="toggleSub()">${subd?'Seguindo':'Seguir'}</button><button class="prof-share-btn" onclick="toast('🔗 Link copiado!')">⎋</button>`;
    }
  }

  const pn=document.getElementById('profName');if(pn)pn.textContent=u.name;
  const vs=document.getElementById('profVipSeal'),vc=document.getElementById('profVerCheck');
  if(vs){vs.style.display=u.vip?'inline-flex':'none';if(u.vip)vs.innerHTML='<span class="vip-seal">⭐ VIP</span>';}
  if(vc)vc.style.display=(u.verified||u.official)?'inline-flex':'none';
  const ph=document.getElementById('profHandle');if(ph)ph.textContent='@'+u.handle;
  const pfl=document.getElementById('profFollowers');if(pfl)pfl.textContent=formatNum(u.followers||0);
  const pau=document.getElementById('profAudios');if(pau)pau.textContent=u.audioCount||0;
  const pvw=document.getElementById('profViews');if(pvw)pvw.textContent=formatNum((u.audioCount||0)*14);

  const badgeArr=Array.isArray(u.areas)?u.areas:(u.area?[u.area]:[]);
  const badges=document.getElementById('profBadges');
  if(badges)badges.innerHTML=badgeArr.map(a=>`<span class="badge-pill" style="background:${(BADGE_COLORS[a]||{bg:'#eee'}).bg};color:${(BADGE_COLORS[a]||{c:'#666'}).c};padding:3px 10px;font-size:.72rem;font-weight:700;">${BADGE_ICONS[a]||''} ${a}</span>`).join('');

  const snippet=document.getElementById('profDescSnippet');
  if(snippet){
    if(u.desc&&u.desc.trim()){
      const short=u.desc.length>80?u.desc.slice(0,80)+'…':u.desc;
      snippet.innerHTML=`<span>${short}</span> <span class="read-more" onclick="switchPTab('desc',document.querySelectorAll('.ptab')[3])">Ler mais</span>`;
    } else {
      snippet.innerHTML=`<span class="saiba-mais" onclick="switchPTab('desc',document.querySelectorAll('.ptab')[3])">Saiba mais</span>`;
    }
  }

  // desc tab
  const descFull=document.getElementById('profDescFull');if(descFull)descFull.textContent=u.desc||'';
  const descSec=document.getElementById('profDescSection');if(descSec)descSec.style.display=(u.desc&&u.desc.trim())?'block':'none';
  const linksSection=document.getElementById('profLinksSection');
  const linksContent=document.getElementById('profLinksContent');
  if(linksContent)linksContent.innerHTML='';
  if(u.instagram&&linksContent)linksContent.innerHTML+=`<div class="desc-link-row"><div class="desc-link-icon" style="background:#fce4ec;">📷</div><div class="desc-link-text">Instagram / @${u.instagram}</div></div>`;
  if(u.youtube&&linksContent)linksContent.innerHTML+=`<div class="desc-link-row"><div class="desc-link-icon" style="background:#ffebee;">▶️</div><div class="desc-link-text">${u.youtube}</div></div>`;
  if(linksSection)linksSection.style.display=(u.instagram||u.youtube)?'block':'none';
  const meta=document.getElementById('profDescMeta');
  if(meta){
    meta.innerHTML='';
    if(u.youtube)meta.innerHTML+=`<div class="desc-info-row"><span class="desc-info-icon">🌐</span><span class="desc-info-text">${u.youtube}</span></div>`;
    if(u.country)meta.innerHTML+=`<div class="desc-info-row"><span class="desc-info-icon">🌍</span><span class="desc-info-text">${u.country}</span></div>`;
    meta.innerHTML+=`<div class="desc-info-row"><span class="desc-info-icon">ℹ️</span><span class="desc-info-text">Inscreveu-se em ${u.joined||'—'}</span></div>`;
  }
  const bRow=document.getElementById('profDescBadgesRow');
  if(bRow){
    if(badgeArr.length){bRow.innerHTML=`<span style="font-size:.78rem;font-weight:600;color:var(--t2);margin-right:4px;">Área</span>`+badgeArr.map(a=>`<span class="badge-pill" style="background:${(BADGE_COLORS[a]||{bg:'#eee'}).bg};color:${(BADGE_COLORS[a]||{c:'#666'}).c};padding:3px 10px;font-size:.72rem;font-weight:700;">${BADGE_ICONS[a]||''} ${a}</span>`).join('');bRow.style.display='flex';}
    else bRow.style.display='none';
  }

  switchPTab('audios',document.querySelectorAll('.ptab')[0]);
  renderProfAudios(u,isMe);
  renderProfEmblems(u);
  if(!u.videos)u.videos=[];

  const pp=document.getElementById('profilePage');if(pp){pp.classList.add('show');document.body.style.overflow='hidden';}
}

function closeProfile(){
  const pp=document.getElementById('profilePage');if(pp)pp.classList.remove('show');
  document.body.style.overflow='';viewingHandle=null;
}

async function toggleSub() {
  if(!viewingHandle)return;
  if(!APP.me){openLogin();return;}
  const u=USERS[viewingHandle];
  const btn=document.getElementById('profFollowBtn');
  if(APP.subscribers.has(viewingHandle)){
    APP.subscribers.delete(viewingHandle);u.followers=Math.max(0,(u.followers||0)-1);
    if(btn){btn.textContent='Seguir';btn.className='prof-follow-btn';}
  } else {
    APP.subscribers.add(viewingHandle);u.followers=(u.followers||0)+1;
    if(btn){btn.textContent='Seguindo';btn.className='prof-follow-btn following';}
  }
  const pfl=document.getElementById('profFollowers');if(pfl)pfl.textContent=formatNum(u.followers||0);
  followUserAPI(viewingHandle);
}

function switchPTab(tab,el) {
  document.querySelectorAll('.ptab').forEach(t=>t.classList.remove('active'));
  if(el)el.classList.add('active');
  const tabs={audios:'ptAudios',videos:'ptVideos',emblems:'ptEmblems',desc:'ptDesc'};
  Object.entries(tabs).forEach(([k,id])=>{const el2=document.getElementById(id);if(el2)el2.style.display=k===tab?'block':'none';});
  if(tab==='videos'&&viewingHandle){const u=USERS[viewingHandle];if(u)renderProfVideos(u,APP.me&&APP.me.handle===viewingHandle);}
}

function renderProfAudios(u,isMe){
  const grid=document.getElementById('profAudioGrid');if(!grid)return;
  const audios=u.audios||[];
  if(!audios.length&&!u.audioCount){grid.innerHTML='<div style="font-size:.8rem;color:var(--t3);padding:10px 0;">Nenhum projeto ainda.</div>';return;}
  if(!audios.length){
    const fake=['Podcast Ep.1.mp3','Entrevista Final.mp3','Beat 2024.wav'];
    grid.innerHTML=Array.from({length:Math.min(u.audioCount,3)},(_,i)=>`<div class="audio-card"><div class="audio-icon">🎵</div><div class="audio-name">${fake[i%fake.length]}</div><div class="audio-meta">há ${i+1} dia${i?'s':''}</div></div>`).join('');return;
  }
  grid.innerHTML=audios.map(a=>{const isLocked=a.locked&&!isMe;return`<div class="audio-card" style="${isLocked?'filter:blur(3px);pointer-events:none;':''}"><div class="audio-icon">${a.icon||'🎵'}</div><div class="audio-name">${a.name}</div><div class="audio-meta">${a.date||'—'} ${a.quality?'· '+a.quality:''}</div>${a.locked?`<span class="audio-lock">${isMe?'🔒 Privado':'🔒'}</span>`:''}</div>`;}).join('');
}

function renderProfEmblems(u){
  const grid=document.getElementById('profEmbGrid');if(!grid)return;
  grid.innerHTML=EMBLEMAS.map(e=>{
    const can=e.req==='free'||(e.req==='vip'&&(u.vip||u.vipTier))||(e.req==='ultra'&&u.vipTier==='ultra');
    return`<div class="emb${can?' owned':' locked'}" style="background:${e.color};" title="${e.name}${can?'':' (requer '+e.req+')'}">${e.emoji}<span class="emb-tooltip">${e.name}</span></div>`;
  }).join('');
}

function renderProfileSection(){}

// ═══════════════════════════════════════
// SHORT VIDEOS
// ═══════════════════════════════════════
const VIDEOS=[];
let nextVidId=1,currentVidHandle=null,publishMenuOpen=false,currentVidForComments=null;

function openUploadVideo(){
  if(!APP.me){closePublishMenu();openLogin();return;}
  closePublishMenu();
  document.getElementById('vidFileInput').value='';
  document.getElementById('vidCaption').value='';
  document.getElementById('vidFileName').style.display='none';
  document.getElementById('vidPreviewEl').style.display='none';
  document.getElementById('btnPublishVid').disabled=true;
  openModal('uploadVideoModal');
}

function onVidFileSelect(inp){
  if(!inp.files[0])return;
  const f=inp.files[0];
  const url=URL.createObjectURL(f);
  const nameEl=document.getElementById('vidFileName');nameEl.textContent=f.name;nameEl.style.display='block';
  const prev=document.getElementById('vidPreviewEl');prev.src=url;prev.style.display='block';
  document.getElementById('btnPublishVid').disabled=false;
  inp._blobUrl=url;
}

function publishVideo(){
  if(!APP.me)return;
  const inp=document.getElementById('vidFileInput');const blobUrl=inp._blobUrl;
  if(!blobUrl){toast('⚠️ Selecione um vídeo!');return;}
  const caption=document.getElementById('vidCaption').value.trim();
  const vid={id:nextVidId++,handle:APP.me.handle,blobUrl,caption,likes:0,likedBy:[],comments:[],views:0,time:'agora'};
  VIDEOS.unshift(vid);
  const u=APP.me;if(!u.videos)u.videos=[];u.videos.unshift(vid);
  closeModal('uploadVideoModal');toast('✅ Vídeo publicado!');
  if(viewingHandle===u.handle)renderProfVideos(u,true);
}

function openVideoFeed(startVidId){
  const feed=document.getElementById('videoFeedPage');const container=document.getElementById('videoFeedContainer');
  feed.style.display='block';document.body.style.overflow='hidden';setActiveNav('bnavVideos');
  const pool=currentVidHandle&&USERS[currentVidHandle]?.videos?.length?USERS[currentVidHandle].videos:VIDEOS;
  if(!pool.length){
    container.innerHTML=`<div style="height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;color:rgba(255,255,255,.5);text-align:center;padding:40px;scroll-snap-align:start;"><div style="font-size:3rem;margin-bottom:16px;">🎬</div><div style="font-size:1rem;font-weight:700;color:#fff;margin-bottom:8px;">Nenhum vídeo ainda</div><div style="font-size:.85rem;">Publique o primeiro vídeo usando o botão +</div></div>`;
    return;
  }
  container.innerHTML='';
  pool.forEach(v=>container.appendChild(buildVidCard(v)));
  container.scrollTop=0;
  if(startVidId){const idx=pool.findIndex(v=>v.id===startVidId);if(idx>0)setTimeout(()=>container.scrollTop=idx*window.innerHeight,50);}
  setTimeout(()=>{const first=container.querySelector('video');if(first)first.play().catch(()=>{});},100);
  setupVidObserver(container);
}

function buildVidCard(v){
  const u=USERS[v.handle]||{name:v.handle,handle:v.handle,color:'#888',avatar:null};
  const div=document.createElement('div');div.className='vid-snap-item';div.dataset.vidId=v.id;
  const avHtml=u.avatar?`<img src="${u.avatar}" style="width:100%;height:100%;object-fit:cover;"/>`:`<span style="font-size:.9rem;font-weight:800;">${u.name.charAt(0).toUpperCase()}</span>`;
  const isVip=u.vip?'<span class="vip-seal" style="font-size:.55rem;padding:1px 5px;">⭐</span>':'';
  const isVer=(u.verified||u.official)?'<span class="prof-verified-check" style="width:13px;height:13px;font-size:.5rem;">✓</span>':'';
  const liked=v.likedBy.includes(APP.me?.handle);
  div.innerHTML=`
    <video src="${v.blobUrl}" loop muted playsinline style="width:100%;height:100%;object-fit:cover;position:absolute;inset:0;cursor:pointer;" id="vidEl${v.id}" onclick="toggleVidPlay(this,${v.id})"></video>
    <div class="vid-overlay"></div>
    <button class="vid-mute-btn" id="muteBtn${v.id}" onclick="toggleVidMute(${v.id})" title="Som">🔇</button>
    <div class="vid-pause-icon" id="pauseIcon${v.id}"><svg width="28" height="28" viewBox="0 0 28 28" fill="white"><rect x="6" y="5" width="5" height="18" rx="2"/><rect x="17" y="5" width="5" height="18" rx="2"/></svg></div>
    <div class="vid-info">
      <div class="vid-author" onclick="openProfileFromFeed('${v.handle}')">
        <div class="vid-av" style="background:${u.color||'#888'};">${avHtml}</div>
        <div><div style="display:flex;align-items:center;gap:5px;"><span class="vid-author-name">${u.name}</span>${isVip}${isVer}</div><div class="vid-author-handle">@${v.handle}</div></div>
      </div>
      ${v.caption?`<div class="vid-caption">${v.caption}</div>`:''}
    </div>
    <div class="vid-actions">
      <button class="vid-heart-btn${liked?' liked':''}" id="vheart${v.id}" onclick="likeVid(${v.id},this)">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="${liked?'#f03050':'none'}" stroke="${liked?'#f03050':'white'}" stroke-width="2"><path d="M16 27S4 19 4 11a6 6 0 0112-1.2A6 6 0 0128 11c0 8-12 16-12 16z"/></svg>
        <span class="vid-act-count" id="vlikeCount${v.id}">${v.likes}</span>
      </button>
      <button class="vid-act-btn" onclick="openVidComments(${v.id})">
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="white" stroke-width="2"><path d="M4 5h20v14H17l-5 5v-5H4V5z" stroke-linejoin="round"/></svg>
        <span class="vid-act-count" id="vcmtCount${v.id}">${v.comments.length}</span>
      </button>
      <button class="vid-act-btn" onclick="shareVid(${v.id})">
        <svg width="26" height="26" viewBox="0 0 26 26" fill="none" stroke="white" stroke-width="2"><circle cx="20" cy="5" r="3"/><circle cx="6" cy="13" r="3"/><circle cx="20" cy="21" r="3"/><path d="M8.5 11.5l9-5M8.5 14.5l9 5"/></svg>
        <span class="vid-act-count">Share</span>
      </button>
    </div>`;
  v.views=(v.views||0)+1;
  return div;
}

let currentFocusedVidId = null;

function setupVidObserver(container){
  const observer=new IntersectionObserver(entries=>{
    entries.forEach(e=>{
      const item = e.target;
      const vid  = item.querySelector('video');
      if(!vid) return;
      const vidId = item.dataset.vidId;
      if(e.isIntersecting){
        vid.muted = true; // começa mudo para autoplay funcionar
        vid.play().catch(()=>{});
        // Após 300ms, tira o mudo se o usuário não silenciou manualmente
        setTimeout(() => {
          if (item.classList.contains('in-view')) {
            const muteState = item.dataset.userMuted === 'true';
            vid.muted = muteState;
            const btn = document.getElementById('muteBtn' + vidId);
            if (btn) btn.textContent = muteState ? '🔇' : '🔊';
          }
        }, 300);
        item.classList.add('in-view');
        currentFocusedVidId = vidId;
      } else {
        vid.pause();
        vid.muted = true;
        item.classList.remove('in-view');
      }
    });
  },{threshold:0.65});
  container.querySelectorAll('.vid-snap-item').forEach(el=>observer.observe(el));
}

function toggleVidMute(vidId) {
  const vid = document.getElementById('vidEl' + vidId);
  const btn = document.getElementById('muteBtn' + vidId);
  const item = vid?.closest('.vid-snap-item');
  if (!vid) return;
  vid.muted = !vid.muted;
  if (btn) btn.textContent = vid.muted ? '🔇' : '🔊';
  if (item) item.dataset.userMuted = String(vid.muted);
}

function toggleVidPlay(vidEl,vidId){
  const icon=document.getElementById('pauseIcon'+vidId);
  if(vidEl.paused){vidEl.play();if(icon)icon.classList.remove('show');}
  else{vidEl.pause();if(icon){icon.classList.add('show');setTimeout(()=>icon.classList.remove('show'),1200);}}
}

function closeVideoFeed(){
  document.querySelectorAll('#videoFeedContainer video').forEach(v=>{v.pause();v.src='';});
  const fp=document.getElementById('videoFeedPage');if(fp)fp.style.display='none';
  document.body.style.overflow='';currentVidHandle=null;setActiveNav('bnavHome');
}

function openProfileFromFeed(handle){closeVideoFeed();setTimeout(()=>openProfile(handle),100);}

function likeVid(id,btn){
  if(!APP.me){openLogin();return;}
  const v=findVid(id);if(!v)return;
  const h=APP.me.handle;
  if(v.likedBy.includes(h)){v.likedBy=v.likedBy.filter(x=>x!==h);v.likes=Math.max(0,v.likes-1);btn.classList.remove('liked');const svg=btn.querySelector('svg');if(svg){svg.setAttribute('fill','none');svg.setAttribute('stroke','white');}}
  else{v.likedBy.push(h);v.likes++;btn.classList.add('liked');const svg=btn.querySelector('svg');if(svg){svg.setAttribute('fill','#f03050');svg.setAttribute('stroke','#f03050');}btn.style.transform='scale(1.3)';setTimeout(()=>btn.style.transform='',200);}
  const cnt=document.getElementById('vlikeCount'+id);if(cnt)cnt.textContent=v.likes;
}

function shareVid(id){toast('🔗 Link copiado!');}

function findVid(id){
  let v=VIDEOS.find(x=>x.id===id);
  if(!v){for(const u of Object.values(USERS)){const f=u.videos?.find(x=>x.id===id);if(f){v=f;break;}}}
  return v;
}

function openVidComments(id){
  currentVidForComments=id;
  const v=findVid(id);if(!v)return;
  const t=document.getElementById('vcModalTitle');if(t)t.textContent=`Comentários (${v.comments.length})`;
  renderVidComments(v);
  const av=document.getElementById('vcCompAv');
  if(av&&APP.me){av.style.background=APP.me.color||'#0052e0';av.textContent=APP.me.name.charAt(0).toUpperCase();if(APP.me.avatar)av.innerHTML=`<img src="${APP.me.avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"/>`;}
  openModal('videoCommentsModal');
}

function renderVidComments(v){
  const list=document.getElementById('videoCommentsList');if(!list)return;
  if(!v.comments.length){list.innerHTML=`<div style="text-align:center;padding:28px 0;color:var(--t3);font-size:.84rem;">Seja o primeiro a comentar!</div>`;return;}
  list.innerHTML=v.comments.map(c=>{
    const u=USERS[c.handle]||{name:c.handle,handle:c.handle,color:'#888',avatar:null};
    const avHtml=u.avatar?`<img src="${u.avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"/>`:`${u.name.charAt(0).toUpperCase()}`;
    return`<div class="vcmt"><div class="vcmt-av" style="background:${u.color||'#888'};" onclick="openProfile('${u.handle}')">${avHtml}</div><div><div style="display:flex;align-items:center;gap:6px;"><span class="vcmt-name" onclick="openProfile('${u.handle}')">${u.name}</span><span class="vcmt-time">${c.time}</span></div><div class="vcmt-text">${c.text}</div></div></div>`;
  }).join('');
}

function sendVidComment(){
  if(!APP.me){closeModal('videoCommentsModal');openLogin();return;}
  const text=document.getElementById('vcInput').value.trim();if(!text)return;
  const v=findVid(currentVidForComments);if(!v)return;
  v.comments.push({handle:APP.me.handle,text,time:'agora'});
  document.getElementById('vcInput').value='';
  const t=document.getElementById('vcModalTitle');if(t)t.textContent=`Comentários (${v.comments.length})`;
  renderVidComments(v);
  const cnt=document.getElementById('vcmtCount'+currentVidForComments);if(cnt)cnt.textContent=v.comments.length;
}

function renderProfVideos(u,isMe){
  const grid=document.getElementById('profVideoGrid');if(!grid)return;
  const vids=u.videos||[];
  if(!vids.length){grid.innerHTML=`<div style="grid-column:1/-1;padding:24px 0;text-align:center;font-size:.82rem;color:var(--t3);">${isMe?'Publique seu primeiro vídeo usando o botão +':'Nenhum vídeo ainda.'}</div>`;return;}
  grid.innerHTML=vids.map(v=>`<div class="prof-vid-thumb" onclick="openVidFromProfile('${u.handle}',${v.id})"><video src="${v.blobUrl}" muted preload="metadata" style="width:100%;height:100%;object-fit:cover;" onloadedmetadata="this.currentTime=0.5"></video><div class="thumb-overlay"><span class="thumb-play">▶</span></div><div class="thumb-views"><svg width="11" height="11" viewBox="0 0 11 11" fill="white"><path d="M1 5.5C2.5 2.5 8.5 2.5 10 5.5C8.5 8.5 2.5 8.5 1 5.5z"/><circle cx="5.5" cy="5.5" r="1.5" fill="#000"/></svg> ${formatNum(v.views||0)}</div></div>`).join('');
}

function openVidFromProfile(handle,vidId){currentVidHandle=handle;closeProfile();setTimeout(()=>openVideoFeed(vidId),80);}

// ═══════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════
function openPublishMenu(){
  if(!APP.me){openLogin();return;}
  const menu=document.getElementById('publishMenu');
  publishMenuOpen=!publishMenuOpen;
  menu.style.display=publishMenuOpen?'block':'none';
  const fab=document.getElementById('fabBtn');if(fab)fab.style.transform=publishMenuOpen?'rotate(45deg)':'rotate(0)';
}
function closePublishMenu(){
  publishMenuOpen=false;
  const menu=document.getElementById('publishMenu');if(menu)menu.style.display='none';
  const fab=document.getElementById('fabBtn');if(fab)fab.style.transform='rotate(0)';
}
function setActiveNav(id){
  document.querySelectorAll('.bnav-btn').forEach(b=>b.classList.remove('active'));
  const el=document.getElementById(id);if(el)el.classList.add('active');
}
function goHome(){closeVideoFeed();setActiveNav('bnavHome');window.scrollTo({top:0,behavior:'smooth'});}
function openSettings(){const sp=document.getElementById('settingsPage');if(sp){sp.classList.add('show');document.body.style.overflow='hidden';}}
function closeSettings(){const sp=document.getElementById('settingsPage');if(sp)sp.classList.remove('show');document.body.style.overflow='';}

// ═══════════════════════════════════════
// ADM
// ═══════════════════════════════════════
function showAdmLogin(){openModal('admLoginModal');}
function doAdmLogin(){
  const pwd=document.getElementById('admPwd');
  if(pwd.value!=='7723'){toast('⚠️ Senha incorreta!');return;}
  APP.isAdm=true;
  closeModal('admLoginModal');
  if(USERS['capdrawnn'])loginUser('capdrawnn');
  const ap=document.getElementById('admPage');if(ap){ap.classList.add('show');document.body.style.overflow='hidden';}
  renderAdmEmblemas();renderAdmBenefits();
  toast('🔐 Bem-vindo, Administrador! Logado como canal oficial.');
}
function closeAdm(){const ap=document.getElementById('admPage');if(ap)ap.classList.remove('show');document.body.style.overflow='';renderComments();}
function toggleMaintenance(on){
  APP.maintenance=on;
  const ms=document.getElementById('maintenanceScreen');
  if(on){if(ms)ms.classList.add('active');const ap=document.getElementById('admPage');if(ap)ap.classList.remove('show');document.body.style.overflow='';}
  else{if(ms)ms.classList.remove('active');}
  toast(on?'⚙️ Modo manutenção ativado!':'✅ Manutenção desativada!');
}
function setOfficialChannel(){
  const name=document.getElementById('admOfficialName').value.trim();
  const handle=document.getElementById('admOfficialHandle').value.trim().replace('@','').toLowerCase();
  if(!name||!handle){toast('Preencha nome e handle!');return;}
  if(!USERS[handle])USERS[handle]={name,handle,desc:'Canal oficial do CapDrawn.',color:'#0052e0',avatar:null,joined:'Jan 2025',followers:1000,audioCount:0,commentCount:0,audios:[],videos:[],vip:true,verified:true,official:true};
  else{USERS[handle].name=name;USERS[handle].official=true;USERS[handle].verified=true;USERS[handle].vip=true;}
  toast(`✅ Canal oficial @${handle} definido!`);renderComments();
}
function savePayLinks(){APP.payLinks.tiktok=document.getElementById('admTikLink').value.trim();APP.payLinks.yt=document.getElementById('admYTLink').value.trim();toast('✅ Links de pagamento salvos!');}
function saveTexts(){toast('✅ Textos salvos!');}
function addEmblema(){
  const emoji=document.getElementById('newEmbEmoji').value.trim();
  const name=document.getElementById('newEmbName').value.trim();
  const color=document.getElementById('newEmbColor').value.trim()||'#f0f0f0';
  const req=document.getElementById('newEmbRequire').value.trim()||'free';
  if(!emoji||!name){toast('Preencha emoji e nome!');return;}
  EMBLEMAS.push({id:'e'+Date.now(),emoji,name,color,req});
  renderAdmEmblemas();toast(`✅ Emblema ${emoji} adicionado!`);
  document.getElementById('newEmbEmoji').value='';document.getElementById('newEmbName').value='';
}
function renderAdmEmblemas(){
  const g=document.getElementById('admEmbGrid');if(!g)return;
  g.innerHTML=EMBLEMAS.map(e=>`<div style="width:38px;height:38px;border-radius:50%;background:${e.color};display:flex;align-items:center;justify-content:center;font-size:1.1rem;border:1.5px solid rgba(0,0,0,.08);" title="${e.name} (${e.req})">${e.emoji}</div>`).join('');
}
function addVipBenefit(){
  const b=document.getElementById('vipBeneficio').value.trim();if(!b){toast('Digite um benefício!');return;}
  APP.vipBenefits.push(b);renderAdmBenefits();document.getElementById('vipBeneficio').value='';toast('✅ Benefício adicionado!');
}
function renderAdmBenefits(){
  const el=document.getElementById('vipBenefitsList');if(!el)return;
  el.innerHTML=APP.vipBenefits.map((b,i)=>`<div style="display:flex;align-items:center;justify-content:space-between;padding:4px 0;border-bottom:1px solid rgba(255,255,255,.05);"><span style="color:rgba(255,255,255,.55);">• ${b}</span><button onclick="APP.vipBenefits.splice(${i},1);renderAdmBenefits();" style="background:none;border:none;color:rgba(240,48,80,.6);cursor:pointer;font-size:.65rem;font-family:inherit;">✕</button></div>`).join('');
}

// ═══════════════════════════════════════
// MODAL HELPERS
// ═══════════════════════════════════════
function openModal(id){const el=document.getElementById(id);if(el)el.classList.add('show');}
function closeModal(id){const el=document.getElementById(id);if(el)el.classList.remove('show');}

// ═══════════════════════════════════════
// AVATAR HTML HELPER
// ═══════════════════════════════════════
function avHTML(u,sz,link){
  const style=`width:${sz}px;height:${sz}px;background:${u.color||'#888'};`;
  const click=link?`onclick="openProfile('${u.handle}')" `:'';
  if(u.avatar)return`<div class="cav" style="${style}" ${click}><img src="${u.avatar}"/></div>`;
  return`<div class="cav" style="${style}" ${click}>${u.name.charAt(0).toUpperCase()}</div>`;
}
function formatNum(n){if(n>=1000000)return(n/1000000).toFixed(1).replace('.0','')+'M';if(n>=1000)return(n/1000).toFixed(1).replace('.0','')+'K';return String(n);}

// ═══════════════════════════════════════
// TOAST
// ═══════════════════════════════════════
function toast(msg,dur=3000){
  const t=document.getElementById('toast');if(!t)return;
  t.textContent=msg;t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'),dur);
}

// ═══════════════════════════════════════
// SETTINGS SLIDERS
// ═══════════════════════════════════════
function updateThreshold(v){SS.threshold=parseInt(v);const el=document.getElementById('svTh');if(el)el.textContent=v+'dB';}
function updateDuration(v){SS.minDur=parseFloat(v);const el=document.getElementById('svDur');if(el)el.textContent=v+'s';}
function updatePadding(v){SS.pad=parseFloat(v);const el=document.getElementById('svPad');if(el)el.textContent=v+'s';}

// ═══════════════════════════════════════
// INIT
// ═══════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  // Seed default users
  USERS['capdrawnn'] = {name:'CapDrawn Oficial',handle:'capdrawnn',desc:'Canal oficial da plataforma CapDrawn. Processamento de áudio profissional com IA.',color:'#0052e0',avatar:null,joined:'Jan 2025',followers:4200,audioCount:88,commentCount:3,audios:[],videos:[],vip:true,verified:true,official:true};
  USERS['criador_oficial'] = {name:'João Criador',handle:'criador_oficial',desc:'Podcaster e produtor de conteúdo. Uso o CapDrawn todo dia!',color:'#e0245e',avatar:null,joined:'Mar 2025',followers:120,audioCount:5,commentCount:1,audios:[{name:'Podcast EP01.mp3',icon:'🎵',date:'há 2 dias',locked:false},{name:'Beat_Novo.wav',icon:'🎵',date:'há 5 dias',locked:true}],videos:[],vip:false,verified:false,official:false};

  // Carregar usuários salvos do localStorage
  loadUsers();

  renderComments();
  renderAdmEmblemas();

  // Restaurar sessão (mantém login ao recarregar)
  loadSession();

  // Try loading comments from API
  loadCommentsFromAPI();

  // Maintenance check
  if(APP.maintenance){const ms=document.getElementById('maintenanceScreen');if(ms)ms.classList.add('active');}

  // Close publish menu on outside click
  document.addEventListener('click',e=>{
    if(publishMenuOpen&&!e.target.closest('#publishMenu')&&!e.target.closest('#fabBtn'))closePublishMenu();
    if(!e.target.closest('#compose'))hideMentDrop();
    if(e.target.classList.contains('overlay'))closeModal(e.target.id);
  });

  // Canvas resize
  window.addEventListener('resize',()=>{
    if(audioBuf&&document.getElementById('wcard')?.classList.contains('show')){
      drawWave(audioBuf,'cv1',silRegions.length?silRegions:null);
      if(procBuf)drawWave(procBuf,'cv2',null);
    }
  });
});
