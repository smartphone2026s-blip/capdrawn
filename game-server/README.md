# 2D Strike - Servidor de Jogo

## Como funciona

```
APK (2D Strike) ──UDP:7579──► Servidor UDP (game-server/)
                                      │
                                      │ HTTP interno
                                      ▼
                              API Next.js (/api/game/*)
                                      │
                                      ▼
                              PostgreSQL (Railway)
                              tabelas: GameAccount, GameRoom, GameFriend...
```

## Variáveis de ambiente necessárias

Adicione no Railway (nos dois serviços):

```
DATABASE_URL=          # já existe no CapDrawn
GAME_SERVER_KEY=       # chave secreta — invente uma, ex: strike_xk9mq2026
GAME_API_BASE=         # URL do CapDrawn, ex: https://capdrawn.up.railway.app
GAME_UDP_PORT=7579
```

## Deploy no Railway

### 1. Migrar o banco (rodar uma vez)
No serviço do CapDrawn, abrir o Shell e rodar:
```bash
npx prisma migrate dev --name add-game-tables
```
Ou em produção:
```bash
npx prisma db push
```

### 2. Criar segundo serviço no Railway
- No painel do Railway → seu projeto → **"+ New Service"**
- Escolher **"GitHub Repo"** → mesmo repositório
- Em **"Root Directory"** colocar: `game-server`
- Adicionar as variáveis de ambiente acima
- O Railway vai expor uma porta TCP — anote o IP/porta gerado

### 3. Atualizar IP no APK (futuro)
O APK atual aponta para `88.218.93.113:7579`.
Quando o servidor estiver rodando, o IP do Railway vai substituir esse.

## Protocolo UDP (tokens)

| Comando enviado pelo APK | Resposta do servidor |
|--------------------------|----------------------|
| `REG\|user\|pass`        | `_regok_` ou `_regerror_` |
| `LOGIN\|user\|pass`      | `_connloginok_\|rank\|kills\|deaths\|wins` |
| `TMPLOGIN\|user`         | `_conntmpok_` |
| `GETSRV`                 | `_getsrv_\|ip\|porta\|nome` |
| `PARTLIST`               | `_partlist_\|...` |
| `ADDPART\|nome\|mapa\|max` | `_addpartok_` |
| `STATS\|kills\|deaths\|won` | `_statpartok_` |
| `FRLIST`                 | `_frlist_\|...` |
| `PING`                   | `PONG` |

## Arquivos criados (não quebram o CapDrawn)

```
pages/api/game/register.js   ← nova rota
pages/api/game/login.js      ← nova rota
pages/api/game/rooms.js      ← nova rota
pages/api/game/stats.js      ← nova rota
pages/api/game/friends.js    ← nova rota
prisma/schema.prisma         ← adicionadas tabelas GameAccount, GameRoom, GameFriend, GameFriendReq
game-server/server.js        ← servidor UDP separado
game-server/package.json
game-server/railway.toml
railway.toml                 ← config do serviço principal
```
