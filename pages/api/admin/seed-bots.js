// pages/api/admin/seed-bots.js
// Cria as contas bot no banco de dados (chamar 1x após deploy)
// Usa DiceBear API para fotos de perfil meme (gratuito, sem auth)
// GET /api/admin/seed-bots → seed + retorna lista

import prisma from '../../../lib/prisma'
import bcrypt from 'bcryptjs'

const BOT_NAMES = [
  "Arquivo Secreto","Nexus Void","Sistema X","Entidade 9","Memória Oculta",
  "Frequência Zero","Observatório NULL","Projeto Silêncio","Canal Perdido",
  "Transmissão 404","Usuário Deletado","Dimensão Paralela","Sinal Interrompido",
  "Vazio Digital","Protocolo 447","Fragmento Eterno","Nó Corrompido",
  "Ghost Channel","Arquivo Morto","Eco do Vazio","MemeCore 9","Rede Sombria",
  "Void.exe","DankNet","Nexo Meme","Glitch TV","Error 418","VapourMeme",
  "Signal Lost","Bytes Perdidos"
]

const BOT_HANDLES = [
  "arquivo.secreto","nexusvoid","sistemax","entidade9","memoriaoculta",
  "frequencia0","obs.null","projetosilencio","canalperdido","transmissao404",
  "usuariodeletado","dimensaoparalela","sinalinterrompido","vaziodigital",
  "protocolo447","fragmentoeterno","nocorrompido","ghostchannel","arquivomorto",
  "ecodovazio","memecore9","void_exe","danknet","nexomeme","glitchtv",
  "error418","vapourmeme","signallost","bytesperdidos","lostmeme"
]

const BOT_SUBS_NUM = [
  1200000,3700000,892000,12400000,2100000,487000,8900000,1800000,
  5500000,3200000,741000,15300000,991000,4600000,2800000,99900000,
  7700000,31100000
]

const BOT_DESCS = [
  "Este canal não existe.\n\nSe você está vendo isso, algo deu errado.\n\nPor favor, não compartilhe este link.",
  "Arquivo de transmissões perdidas.\n\n[CONTEÚDO REMOVIDO]\n[CONTEÚDO REMOVIDO]\n\nPara restauração: █████@████.███",
  "Canal oficial do Projeto ████.\n\nTodos os vídeos foram classificados como confidenciais após o incidente de outubro.\n\nNão pergunte sobre o incidente de outubro.",
  "Você não deveria ter chegado aqui.\n\nEste perfil foi criado automaticamente.\nNenhum humano está por trás disso.\n\nContinue assistindo.",
  "Transmissão automática iniciada em [DATA_INVÁLIDA].\n\nStatus: ATIVO\nOperador: DESCONHECIDO\nLocalização: NULL",
  "Olá.\n\nEstamos monitorando.\n\nObrigado pela sua atenção.",
  "SISTEMA DE TRANSMISSÃO AUTOMÁTICO v0.0.1\n\nCarregando dados do operador...\nERRO: Operador não encontrado",
  "Frequência captada: ██████\nOrigem do sinal: DESCONHECIDA\n\nEste canal continuará transmitindo mesmo após seu fechamento.",
  "Este canal foi registrado por engano.\nO proprietário original não existe mais.",
  "Nada aqui.\nNada aconteceu.\nNão havia nada antes.\nNão haverá nada depois.",
]

// Avatares meme via DiceBear (bottts = robôs, lorelei = personagens estranhos)
function getBotAvatar(handle, i) {
  const styles = ['bottts', 'lorelei', 'adventurer', 'micah', 'pixel-art']
  const style = styles[i % styles.length]
  return `https://api.dicebear.com/7.x/${style}/svg?seed=${encodeURIComponent(handle)}&size=200`
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).end()

  try {
    const hashedPass = await bcrypt.hash('bot_internal_only_2025', 10)
    const results = []

    for (let i = 0; i < BOT_NAMES.length; i++) {
      const handle = BOT_HANDLES[i]
      const name   = BOT_NAMES[i]
      const email  = `${handle.replace(/\./g,'_')}@capdrawnn.internal`
      const avatarUrl = getBotAvatar(handle, i)
      const followers = BOT_SUBS_NUM[i % BOT_SUBS_NUM.length]
      const bio = BOT_DESCS[i % BOT_DESCS.length]

      try {
        const user = await prisma.user.upsert({
          where: { handle },
          update: {
            avatarUrl,
            followers,
            bio,
            isBot: true,
            isVerified: i % 3 === 0,
            isVip: i % 4 === 0,
          },
          create: {
            handle,
            name,
            email,
            password:   hashedPass,
            avatarUrl,
            followers,
            bio,
            isBot:      true,
            isVerified: i % 3 === 0,
            isVip:      i % 4 === 0,
          }
        })
        results.push({ handle: user.handle, status: 'ok' })
      } catch (e) {
        results.push({ handle, status: 'error', error: e.message })
      }
    }

    return res.json({ ok: true, seeded: results.length, results })
  } catch (e) {
    console.error('[seed-bots]', e)
    return res.status(500).json({ ok: false, error: e.message })
  }
}
