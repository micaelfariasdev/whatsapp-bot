const { Client, LocalAuth } = require('whatsapp-web.js')
const cron = require('node-cron')

const qrcode = require('qrcode-terminal')
const axios = require('axios')
const fs = require('fs')
const path = require('path')
const { toZonedTime, format } = require('date-fns-tz')

const subscribersFile = path.join(__dirname, 'evangelhoSubscribers.json')

function loadSubscribers() {
  if (!fs.existsSync(subscribersFile)) return []
  return JSON.parse(fs.readFileSync(subscribersFile))
}

function saveSubscribers(subs) {
  fs.writeFileSync(subscribersFile, JSON.stringify(subs, null, 2))
}

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu'
    ]
  }
})



const userStates = {}

const menuInicial = `Olá! Sou um bot nada haver criado pelo Micael Farias.
Digite uma das opções abaixo para interagir comigo:
1 - Brasileirão
2 - Evangelho do dia`

const menuBrasileirao = `⚽ Opções do Brasileirão:
1 - Jogos de hoje
2 - Próxima rodada
3 - Tabela Atualizada

Digite '0' para voltar ao menu principal.`

client.on('qr', qr => qrcode.generate(qr, { small: true }))

client.on('ready', () => {
  console.log('Bot pronto!')
  client.sendMessage('558681569018@c.us', 'Bot pronto!')
})
// Agendamento diário do evangelho
const verificarHorario = async () => {
  try {
    const { data } = await axios.get('https://liturgia.up.railway.app/v2/')
    const ev = data.leituras.evangelho[0]

    const mensagem = `
📖 *Evangelho do Dia* - ${data.data}
🕊️ ${data.liturgia}

📍 ${ev.referencia}
${ev.titulo}

"${ev.texto}"

❌ Digite *sair* para cancelar o envio diário do evangelho.
    `.trim()

    const subscribers = loadSubscribers()

    for (const number of [...subscribers]) {
      try {
        const atualizados = loadSubscribers()
        if (!atualizados.includes(number)) continue
        await client.sendMessage(number, mensagem)
        console.log(`✅ Enviado para: ${number}`)
      } catch (e) {
        console.error(`❌ Erro ao enviar para ${number}:`, e.message)
      }
    }

    const agora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    console.log(`[${agora}] ✅ Mensagens enviadas.`)

  } catch (err) {
    console.error('❌ Erro ao buscar ou enviar:', err.message)
  }
}

cron.schedule('0 7 * * *', verificarHorario, {
  timezone: 'America/Sao_Paulo'
})



client.on('message', async message => {
  const number = message.from
  const text = message.body.trim().toLowerCase()

  if (!userStates[number]) {
    userStates[number] = { state: 'inicio' }
    return message.reply(menuInicial.trim())
  }

  const state = userStates[number]

  if (text === 'sair' || text === 'parar' || text === 'cancelar') {
    const subs = loadSubscribers()
    const index = subs.indexOf(number)
    if (index !== -1) {
      subs.splice(index, 1)
      saveSubscribers(subs)
      return message.reply('🛑 Você foi removido da lista de envio diário do evangelho.')
    } else {
      return message.reply('Você não está cadastrado para receber o evangelho diário.')
    }
  }

  // Menu inicial
  if (state.state === 'inicio') {
    if (text === '1' || text.includes('jogos')) {
      state.state = 'brasileirao'
      return message.reply(menuBrasileirao)
    } else if (text === '2' || text.includes('evangelho')) {
      state.state = 'evangelho'
    } else {
      return message.reply(menuInicial.trim())
    }
  }

  // Submenu Brasileirão
  if (state.state === 'brasileirao') {
    if (text === '0' || text.includes('voltar') || text.includes('menu')) {
      state.state = 'inicio'
      return message.reply(menuInicial)
    }

    if (text === '1') {
      state.state = 'inicio'
      try {
        const { data } = await axios.get('https://api.football-data.org/v4/competitions/BSA/matches', {
          headers: { 'X-Auth-Token': '18f9c31787b245c0b47573286ef9201d' }
        })

        const { matches } = data
        const timezone = 'America/Sao_Paulo'
        const now = new Date()

        // Pega o início e fim do dia atual no fuso local
        const startOfDay = toZonedTime(now, timezone)
        startOfDay.setHours(0, 0, 0, 0)

        const endOfDay = toZonedTime(now, timezone)
        endOfDay.setHours(23, 59, 59, 999)

        const jogosHoje = matches.filter(m => {
          const utcDate = new Date(m.utcDate)
          const localDate = toZonedTime(utcDate, timezone)
          return (
            localDate >= startOfDay &&
            localDate <= endOfDay
          )
        })

        if (jogosHoje.length === 0) {
          return message.reply(`⚽ Nenhum jogo hoje no Brasileirão.\n\n${menuInicial}`)
        }

        const hojeStr = format(now, 'yyyy-MM-dd', { timeZone: timezone })
        let resposta = `📅 Jogos de hoje no Brasileirão: ${hojeStr}\n\n`

        for (const jogo of jogosHoje) {
          const timeCasa = jogo.homeTeam
          const timeFora = jogo.awayTeam
          const localDate = toZonedTime(new Date(jogo.utcDate), timezone)
          const horario = format(localDate, 'HH:mm', { timeZone: timezone })
          if (jogo.status === 'FINISHED') {
            resposta += `• ${timeCasa.name}  ${jogo.score.fullTime.home} x ${jogo.score.fullTime.away} ${timeFora.name}\n`
          } else {
            resposta += `• ${timeCasa.name} x ${timeFora.name} - ${horario}\n`
          }
        }

        resposta += `\n──────────────\n⬅️ Voltando ao menu:\n${menuInicial}`
        return message.reply(resposta.trim())
      } catch (error) {
        console.error('Erro na API:', error.message)
        return message.reply(`⚠️ Erro ao consultar os jogos.\n\n${menuInicial}`)
      }
    }

    if (text === '2') {
      state.state = 'inicio'
      try {
        const { data } = await axios.get('https://api.football-data.org/v4/competitions/BSA/matches', {
          headers: { 'X-Auth-Token': '18f9c31787b245c0b47573286ef9201d' }
        })

  const { matches } = data
  const proxRodada = matches[0].season.currentMatchday + 1

  const proximaRodada = matches.filter(m => m.matchday === proxRodada)

        if (proximaRodada.length === 0) {
          return message.reply(`⚽ Nenhum jogo encontrado para a próxima rodada.\n\n${menuInicial}`)
        }

        let resposta = `📅 Próxima rodada do Brasileirão: Rodada ${proxRodada}\n──────────────\n`

for (const jogo of proximaRodada) {
    const timezone = 'America/Sao_Paulo'
    const timeCasa = jogo.homeTeam.name
    const timeFora = jogo.awayTeam.name
    const localDate = toZonedTime(new Date(jogo.utcDate), timezone)
    const horario = format(localDate, 'HH:mm', { timeZone: timezone })
    const dataFormatada = format(localDate, 'dd/MM/yyyy', { timeZone: timezone })
    if (jogo.status === 'FINISHED') {
            resposta += `📅 ${dataFormatada} - Finalizado
${timeCasa} ${jogo.score.fullTime.home} x ${jogo.score.fullTime.away} ${timeFora}
──────────────
`
          } else {
            resposta += `📅 ${dataFormatada} - ${horario}
${timeCasa} x ${timeFora}
──────────────
`
            }
  }

        resposta += `\n──────────────\n⬅️ Voltando ao menu:\n${menuInicial}`
        return message.reply(resposta.trim())
      } catch (error) {
        console.error('Erro na API:', error.message)
        return message.reply(`⚠️ Erro ao consultar a próxima rodada.\n\n${menuInicial}`)
      }
    }

    if (text === '3') {
      state.state = 'inicio'
      try {
        const { data } = await axios.get('https://api.football-data.org/v4/competitions/BSA/standings', {
          headers: { 'X-Auth-Token': '18f9c31787b245c0b47573286ef9201d' }
        })

        const { standings } = data
        let tabela = standings[0].table

        let resposta = '```'
         resposta += 'pos - Time          - pts - jgs\n'

for (const time of tabela ) {
 const posisao = String(time.position).padStart(3, ' ')
  const nome = time.team.shortName.padEnd(13, ' ')
  const pontos = String(time.points).padEnd(3, ' ')
  const jogos = String(time.playedGames).padEnd(3, ' ')
             resposta += `${posisao} - ${nome} - ${pontos} - ${jogos}\n`
  }
      resposta += '```'
        resposta += `\n──────────────\n⬅️ Voltando ao menu:\n${menuInicial}`
        return message.reply(resposta.trim())
      } catch (error) {
        console.error('Erro na API:', error.message)
        return message.reply(`⚠️ Erro ao consultar a próxima rodada.\n\n${menuInicial}`)
      }
    }

    return message.reply(menuBrasileirao)
  }

  if (state.state === 'evangelho') {
    try {
      const { data } = await axios.get(`https://liturgia.up.railway.app/v2/`)
      const ev = data.leituras.evangelho[0]

      let resposta = `
📖 *Evangelho do Dia* - ${data.data}
🕊️ ${data.liturgia}

📍 ${ev.referencia}
${ev.titulo}

"${ev.texto}"

Deseja receber o evangelho automaticamente todos os dias?  
Responda com *sim* ou *não*
      `.trim()

      state.state = 'evangelho_subscribe'
      return message.reply(resposta)
    } catch (error) {
      console.error('Erro na API:', error.message)
      state.state = 'inicio'
      return message.reply(`⚠️ Erro ao consultar a API.\n\n${menuInicial.trim()}`)
    }
  }

  if (state.state === 'evangelho_subscribe') {
    if (text === 'sim') {
      const subs = loadSubscribers()
      if (!subs.includes(number)) {
        subs.push(number)
        saveSubscribers(subs)
      }
      state.state = 'inicio'
      return message.reply(`✅ Você foi cadastrado para receber o evangelho diariamente.\n\n${menuInicial.trim()}`)
    } else {
      state.state = 'inicio'
      return message.reply(`${menuInicial.trim()}`)
    }
  }
})

client.initialize()
