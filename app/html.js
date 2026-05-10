// ============================================
// CORREÇÃO 1: Adicionar saveCommentsLocal() onde comentários são criados
// ============================================

// Na função sendComment(), adicionar:
function sendComment(){
  if(!APP.me){openLogin();return;}
  const inp = document.getElementById('compInp');
  const text = inp.value.trim();
  if(!text) return;
  COMMENTS.unshift({id:nextId++, handle:APP.me.handle, text, time:'agora', likes:0, likedBy:[], pinned:false});
  inp.value = '';
  hideMentDrop();
  renderComments();
  saveCommentsLocal(); // ← ADICIONAR ESTA LINHA
  
  // Salva no banco de dados
  fetch('/api/comments',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({handle:APP.me.handle, text, videoId:null})
  }).catch(()=>{});

  // random bot replies
  if(Math.random() < 0.5){
    setTimeout(()=>{
      const replyBot = getRandomBot();
      COMMENTS.unshift({id:nextId++, handle:replyBot.handle, text:`@${APP.me.handle} ${rand(BOT_COMMENTS_POOL)}`, time:'agora', likes:randInt(0,20), likedBy:[], pinned:false, verified:replyBot.verified, vip:replyBot.vip});
      renderComments();
      saveCommentsLocal(); // ← ADICIONAR ESTA LINHA
    }, 2000+Math.random()*3000);
  }
}

// Na função likeComment(), adicionar:
function likeComment(id, btn){
  if(!APP.me){openLogin();return;}
  const c = COMMENTS.find(x=>x.id===id);
  if(!c) return;
  if(!c.likedBy) c.likedBy=[];
  const h = APP.me.handle;
  if(c.likedBy.includes(h)){c.likedBy=c.likedBy.filter(x=>x!==h);c.likes=Math.max(0,(c.likes||0)-1);}
  else{c.likedBy.push(h);c.likes=(c.likes||0)+1;}
  renderComments();
  saveCommentsLocal(); // ← ADICIONAR ESTA LINHA
}

// Na função delComment(), adicionar:
function delComment(id){
  COMMENTS=COMMENTS.filter(x=>x.id!==id);
  renderComments();
  saveCommentsLocal(); // ← ADICIONAR ESTA LINHA
}

// Na função sendSuperChat(), adicionar:
function sendSuperChat(){
  if(!APP.me)return;
  const msg=document.getElementById('scMsg').value.trim(),val=parseInt(document.getElementById('scVal').value);
  if(!msg){toast('Digite uma mensagem!');return;}
  const colors={5:'sc-3',20:'sc-2',50:'sc-1'};
  const cls=colors[val]||'sc-3';
  const sc=document.getElementById('superchats');
  sc.classList.add('show');
  const u=APP.me;
  sc.innerHTML+=`<div class="sc-item ${cls}"><div class="sc-av">${u.name.charAt(0)}</div><div><strong style="font-size:.76rem;">${u.name}</strong><div class="sc-msg">${msg}</div></div><div class="sc-val">R$${val}</div></div>`;
  closeModal('scModal');toast('💛 Super Chat enviado!');
  COMMENTS.unshift({id:nextId++,handle:u.handle,text:`💛 Super Chat R$${val}: ${msg}`,time:'agora',likes:0,likedBy:[],pinned:false});
  renderComments();
  saveCommentsLocal(); // ← ADICIONAR ESTA LINHA
  setTimeout(()=>{const items=sc.querySelectorAll('.sc-item');if(items.length>5)items[0].remove();},15000);
}

// ============================================
// CORREÇÃO 2: Consultar banco de dados no boot para carregar comentários
// ============================================

// Na função loadPersistedData(), adicionar a consulta ao banco:
async function loadPersistedData(){
  try{
    // Usuários locais
    const users=JSON.parse(localStorage.getItem('cdUsers')||'{}');
    Object.values(users).forEach(u=>{if(!u.isBot)USERS[u.handle]=u;});
    
    // Comentários locais
    const comments=JSON.parse(localStorage.getItem('cdComments')||'[]');
    if(comments.length){
      COMMENTS.push(...comments);
      nextId=Math.max(...comments.map(c=>c.id||0),nextId)+1;
    }
    
    // ← ADICIONAR: Buscar comentários do banco de dados
    try{
      const commentsRes = await fetch('/api/comments');
      if(commentsRes.ok){
        const commentsData = await commentsRes.json();
        if(commentsData.comments && commentsData.comments.length){
          commentsData.comments.forEach(c => {
            // Evita duplicatas (compara por texto + handle + timestamp)
            const exists = COMMENTS.some(local => 
              local.handle === c.handle && 
              local.text === c.text && 
              local.time === c.time
            );
            if(!exists){
              COMMENTS.push({
                id: nextId++,
                handle: c.handle,
                text: c.text,
                time: c.time || 'recente',
                likes: c.likes || 0,
                likedBy: c.likedBy || [],
                pinned: c.pinned || false,
                verified: c.verified || false,
                vip: c.vip || false
              });
            }
          });
          // Ordena comentários (pinned primeiro, depois por id decrescente)
          COMMENTS.sort((a,b) => (b.pinned?1:0) - (a.pinned?1:0) || b.id - a.id);
          // Salva localmente após mesclar com banco
          saveCommentsLocal();
        }
      }
    }catch(e){
      console.warn('Erro ao buscar comentários do banco:', e);
    }
    
    // Vídeos salvos localmente (só URLs Cloudinary)
    const videos=JSON.parse(localStorage.getItem('cdVideos')||'[]');
    videos.forEach(v=>{
      if(v.blobUrl&&!COMMUNITY_VIDEOS.find(c=>c.id===v.id))
        COMMUNITY_VIDEOS.push(v);
    });
    if(COMMUNITY_VIDEOS.length){
      nextCommunityVidId=Math.max(...COMMUNITY_VIDEOS.map(v=>v.id||0))+1;
    }
    
    // Busca vídeos do servidor também
    try{
      const res=await fetch('/api/videos/feed');
      if(res.ok){
        const data=await res.json();
        if(data.videos&&data.videos.length){
          data.videos.forEach(v=>{
            const uploaderHandle=v.uploader?.handle||'usuario';
            const uploaderName=v.uploader?.name||uploaderHandle;
            const uploaderAvatar=v.uploader?.avatarUrl||null;

            if(!USERS[uploaderHandle]){
              USERS[uploaderHandle]={
                handle:uploaderHandle, name:uploaderName,
                avatar:uploaderAvatar, color:'#0052e0',
                isBot:false, videos:[],
              };
            } else {
              if(uploaderAvatar) USERS[uploaderHandle].avatar=uploaderAvatar;
              USERS[uploaderHandle].name=uploaderName;
            }

            if(!COMMUNITY_VIDEOS.find(c=>c.dbId===v.id)){
              COMMUNITY_VIDEOS.push({
                id:nextCommunityVidId++,dbId:v.id,
                blobUrl:v.url,caption:v.caption||'🎥 Vídeo da comunidade',
                uploaderHandle,distributed:v.distributed,removed:false,time:'recente',
              });
            }

            if(!USERS[uploaderHandle].videos) USERS[uploaderHandle].videos=[];
            if(!USERS[uploaderHandle].videos.find(x=>x.dbId===v.id)){
              USERS[uploaderHandle].videos.unshift({blobUrl:v.url,caption:v.caption,views:v.views||0,dbId:v.id});
            }
          });
          saveVideosLocal();
        }
      }
    }catch(e){}
    
    // Auto-login via token JWT salvo
    const savedToken=localStorage.getItem('cdToken');
    const loggedIn=localStorage.getItem('cdLoggedIn');
    if(savedToken&&loggedIn){
      fetch('/api/auth/me',{headers:{'Authorization':'Bearer '+savedToken}})
      .then(r=>r.json())
      .then(data=>{
        if(data.ok&&data.user){
          APP.token=savedToken;
          const u=data.user;
          APP.me={
            handle:u.handle, name:u.name, avatar:u.avatarUrl||null,
            email:u.email, vip:u.isVip, verified:u.isVerified,
            isBot:false, videos:[], color:'#0052e0'
          };
          USERS[u.handle]=APP.me;
          loginUser(u.handle);
        } else {
          localStorage.removeItem('cdToken');
          localStorage.removeItem('cdLoggedIn');
        }
      })
      .catch(()=>{
        if(USERS[loggedIn]&&!USERS[loggedIn].isBot)loginUser(loggedIn);
      });
    }
  }catch(e){console.warn('loadPersistedData:',e);}
}

// ============================================
// CORREÇÃO 3: saveProfile() chamando endpoint PUT correto
// ============================================

async function saveProfile(){
  if(!APP.me)return;
  const u=APP.me;
  const btn=document.getElementById('saveProfileBtn');
  if(btn){btn.disabled=true;btn.textContent='Salvando...';}

  u.name=document.getElementById('editName').value.trim()||u.name;
  u.desc=document.getElementById('editDesc').value.trim();
  u.link=document.getElementById('editLink').value.trim();

  try{
    // ← CORRIGIDO: Usar endpoint PUT /api/users/[handle] para atualizar perfil
    const body = {name:u.name, bio:u.desc, link:u.link||''};
    if(editAvUrl) body.avatarBase64=editAvUrl;

    // Antes estava: /api/auth/avatar
    // Agora: /api/users/[handle]
    const res = await fetch(`/api/users/${u.handle}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(APP.token ? {'Authorization': 'Bearer ' + APP.token} : {})
      },
      body: JSON.stringify(body)
    });
    const data = await res.json();

    if(data.ok && data.user){
      // Atualiza com dados reais do servidor
      u.avatar = data.user.avatarUrl || u.avatar;
      u.name = data.user.name || u.name;
      u.desc = data.user.bio || u.desc;
      u.link = data.user.link || u.link;
    }
  }catch(e){
    console.warn('saveProfile server error:', e);
  }

  if(editAvUrl){u.avatar=editAvUrl;editAvUrl=null;}

  saveUserLocal(u);
  if(btn){btn.disabled=false;btn.textContent='Salvar';}
  closeModal('profileModal');
  loginUser(u.handle);
  toast('✅ Perfil atualizado!');
}
