const { Client, LocalAuth } = require('whatsapp-web.js')
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
  authStrategy: new LocalAuth()
})

const userStates = {}

const menuInicial = `Olá! Sou um bot nada haver criado pelo Micael Farias.
Digite uma das opções abaixo para interagir comigo:
1 - Brasileirão
2 - Evangelho do dia`

const menuBrasileirao = `⚽ Opções do Brasileirão:
1 - Jogos de hoje
2 - Próxima rodada
Digite '0' para voltar ao menu principal.`

client.on('qr', qr => qrcode.generate(qr, { small: true }))
client.on('ready', () => console.log('Bot pronto!'))
// Agendamento diário do evangelho
const verificarHorario = async () => {
  const agora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  const [_, horaStr] = agora.split(', ')
  const [hora, minuto] = horaStr.split(':').map(Number)

  if (hora === 7 && minuto === 0) {
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


      console.log(`[${agora}] ✅ Mensagens enviadas.`)

    } catch (err) {
      console.error('❌ Erro ao buscar ou enviar:', err.message)
    }
  }
}

setInterval(verificarHorario, 60 * 1000)

client.on('message', async message => {
  const number = message.from
  const text = message.body.trim().toLowerCase()

  if (!userStates[number]) userStates[number] = { state: 'inicio' }

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
            localDate <= endOfDay &&
            (m.status === 'SCHEDULED' || m.status === 'TIMED')
          )
        })

        if (jogosHoje.length === 0) {
          return message.reply(`⚽ Nenhum jogo hoje no Brasileirão.\n\n${menuInicial}`)
        }

        const hojeStr = format(now, 'yyyy-MM-dd', { timeZone: timezone })
        let resposta = `📅 Jogos de hoje no Brasileirão: ${hojeStr}\n\n`

        for (const jogo of jogosHoje) {
          const timeCasa = jogo.homeTeam.name
          const timeFora = jogo.awayTeam.name
          const localDate = toZonedTime(new Date(jogo.utcDate), timezone)
          const horario = format(localDate, 'HH:mm', { timeZone: timezone })
          resposta += `• ${timeCasa} x ${timeFora} - ${horario}\n`
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
        const jogoTimed = matches.find(m => m.status === 'TIMED')
        const proximaRodada = matches.filter(m => m.matchday === jogoTimed.matchday)

        if (proximaRodada.length === 0) {
          return message.reply(`⚽ Nenhum jogo encontrado para a próxima rodada.\n\n${menuInicial}`)
        }

        let resposta = `📅 Próxima rodada do Brasileirão: Rodada ${jogoTimed.matchday}\n──────────────\n`

        for (const jogo of proximaRodada) {
          const timezone = 'America/Sao_Paulo'
          const timeCasa = jogo.homeTeam.name
          const timeFora = jogo.awayTeam.name
          const localDate = toZonedTime(new Date(jogo.utcDate), timezone)
          const horario = format(localDate, 'HH:mm', { timeZone: timezone })
          const dataFormatada = format(localDate, 'dd/MM/yyyy', { timeZone: timezone })

          resposta += `📅 ${dataFormatada} - ${horario}
${timeCasa} x ${timeFora}
──────────────
`
        }

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
