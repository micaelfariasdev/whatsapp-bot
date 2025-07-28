const { Client, LocalAuth } = require('whatsapp-web.js')
const cron = require('node-cron')
const { MessageMedia } = require('whatsapp-web.js')
const QRCode = require('qrcode')
const qrcode = require('qrcode-terminal')
const axios = require('axios')
const fs = require('fs')
const path = require('path')

const { tabela, proxrodada, jogoshoje } = require('./commands/brasileirao')
const { evangelho } = require('./commands/religiao')

const subscribersFile = path.join(__dirname, 'evangelhoSubscribers.json')

const eventosDir = path.join(__dirname, 'eventos')
if (!fs.existsSync(eventosDir)) fs.mkdirSync(eventosDir)

let eventoTemp = {}
const estados = {} // <- variável global para estados de grupo

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

const FinalPVD =
  `\n──────────────\n⬅️ Voltando ao menu:

Digite uma das opções abaixo para interagir comigo:
1 - Brasileirão
2 - Evangelho do dia
3 - Criar QR code`

const menuInicial = `Olá! Sou um bot nada haver criado pelo Micael Farias.
Digite uma das opções abaixo para interagir comigo:
1 - Brasileirão
2 - Evangelho do dia
3 - Criar QR code`

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
  const text = message.body.trim().toLowerCase()
  const number = message.from



  if (message.from.endsWith('@g.us')) {
    const userId = message.from
    const grupoDir = path.join(eventosDir, message.from)
    if (!fs.existsSync(grupoDir)) fs.mkdirSync(grupoDir, { recursive: true })
    if (text.startsWith('!jogoshoje')) {
      const resp = await jogoshoje()
      return message.reply(resp.trim())
    }

    if (text.startsWith('!tabela')) {
      const resp = await tabela()
      return message.reply(resp.trim())
    }

    if (text.startsWith('!rodada')) {
      const resp = await proxrodada()
      return message.reply(resp.trim())
    }

    if (text.startsWith('!evangelho')) {
      const resp = await evangelho()
      return message.reply(resp.trim())
    }

    if (!estados[userId]) estados[userId] = { state: 'inicio' }
    const state = estados[userId]

    if (text === '/eventos') {
      const grupoDir = path.join(eventosDir, message.from)

      if (!fs.existsSync(grupoDir)) return message.reply('📭 Nenhum evento criado.')

      const files = fs.readdirSync(grupoDir).filter(f => f.endsWith('.json'))

      if (files.length === 0) return message.reply('📭 Nenhum evento criado.')

      let resposta = '📅 *Lista de Eventos:*\n\n'

      for (const file of files) {
        const evento = JSON.parse(fs.readFileSync(path.join(grupoDir, file)))
        resposta += `📌 *${evento.nome}*\n🗓️ ${evento.data} - ${evento.hora}\n📍 ${evento.local}\n👥 ${evento.confirmados?.length || 0} confirmado(s)\n──────────────\n`
      }

      return message.reply(resposta.trim())
    }

    if (text === '/sair' && ['evento_data', 'evento_hora', 'evento_local'].includes(state.state)) {
      estados[userId] = { state: 'inicio' }
      return message.reply('❌ Criação de evento cancelada.')
    }

    if (text.startsWith('/novoe ')) {
      state.evento = {
        nome: text.split('/novoe ')[1],
        data: '',
        hora: '',
        local: '',
        confirmados: [],
        criador: message.author || message.id.participant
      }
      state.state = 'evento_data'
      return message.reply('🗓️ Qual a *data* do evento? (ex: 25/12/2025)')
    }

    if (['evento_data', 'evento_hora', 'evento_local'].includes(state.state)) {
      const autor = message.author || message.id.participant
      if (state.evento.criador !== autor) return

      if (state.state === 'evento_data') {
        state.evento.data = text
        state.state = 'evento_hora'
        return message.reply('⏰ Qual a *hora* do evento? (ex: 19:00)')
      }

      if (state.state === 'evento_hora') {
        state.evento.hora = text
        state.state = 'evento_local'
        return message.reply('📍 Qual o *local* do evento?')
      }

      if (state.state === 'evento_local') {
        state.evento.local = text
        const filePath = path.join(grupoDir, `${state.evento.nome}.json`)
        fs.writeFileSync(filePath, JSON.stringify(state.evento, null, 2))


        const e = state.evento
        estados[userId] = { state: 'inicio' }

        return message.reply(
          `✅ Evento *${e.nome}* criado com sucesso!\n\n🗓️ ${e.data} - ${e.hora}\n📍 ${e.local}`
        )
      }
    }
    if (text.startsWith('/del ')) {
      const nome = text.split('/del ')[1].trim()
      const filePath = path.join(grupoDir, `${nome}.json`)

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
        return message.reply(`🗑️ Evento *${nome}* foi removido com sucesso.`)
      } else {
        return message.reply('❌ Evento não encontrado.')
      }
    }



    if (text.startsWith('/evento ') && state.state === 'inicio') {
      const nome = text.replace('/evento', '').trim().toLowerCase().replace(/\s+/g, '_')
      const filepath = path.join(grupoDir, `${nome}.json`)

      if (!fs.existsSync(filepath)) return message.reply('❌ Evento não encontrado.')

      const evento = JSON.parse(fs.readFileSync(filepath))
      const lista = evento.confirmados.map((n, i) => `${i + 1} - ${n}`).join('\n') || 'Nenhum confirmado ainda.'

      return message.reply(
        `📌 *${evento.nome}*
🗓️ ${evento.data} - ${evento.hora}
📍 ${evento.local}

👥 Confirmados:
${lista}

👉 Para confirmar presença, envie:
/vou ${evento.nome}`)
    }

    if (text.startsWith('/vou')) {
      const nomeEvento = text.replace('/vou', '').trim().toLowerCase().replace(/\s+/g, '_')
      const filepath = path.join(grupoDir, `${nomeEvento}.json`)
      if (!fs.existsSync(filepath)) return message.reply('❌ Evento não encontrado.')

      const evento = JSON.parse(fs.readFileSync(filepath))
      const nomeContato = message._data.notifyName || 'Participante'

      if (!evento.confirmados.includes(nomeContato)) evento.confirmados.push(nomeContato)
      fs.writeFileSync(filepath, JSON.stringify(evento, null, 2))

      const lista = evento.confirmados.map((n, i) => `${i + 1} - ${n}`).join('\n')
      return message.reply(
        `📌 *${evento.nome}*\n🗓️ ${evento.data} - ${evento.hora}\n📍 ${evento.local}\n\n👥 Confirmados:\n${lista}`
      )
    }

    return
  }

  if (message.from.endsWith('@c.us')) {
  const state = userStates[number]

  if (!userStates[number]) {
    userStates[number] = { state: 'inicio' }
    return message.reply(menuInicial.trim())
  }
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
      } else if (text === '3' || text.includes('qr')) {
        state.state = 'qrcode'
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
        const resp = await jogoshoje()
        return message.reply(resp.trim() + FinalPVD)
      }

      if (text === '2') {
        state.state = 'inicio'
        const resp = await proxrodada()
        return message.reply(resp.trim() + FinalPVD)
      }

      if (text === '3') {
        state.state = 'inicio'
        const resp = await tabela()
        return message.reply(resp.trim() + FinalPVD)
      }
    }

    if (state.state === 'evangelho') {
      state.state = 'evangelho_subscribe'
      let resp = await evangelho()
      resp += `\n\nVocê gostaria de receber o evangelho do dia diariamente? Responda com "sim" ou "não".`
      return message.reply(resp.trim() + FinalPVD)
    }

    if (state.state === 'qrcode') {
      let menuQrcode = 'Envie o código que deseja transformar em QR Code.'

      if (state.next === 'gerarqrcode') {
        state.state = 'inicio'
        state.next = null

        try {
          const qrBuffer = await QRCode.toBuffer(text)
          const qrBase64 = qrBuffer.toString('base64')
          const media = new MessageMedia('image/png', qrBase64, 'qrcode.png')
          return client.sendMessage(message.from, media)
        } catch (error) {
          return message.reply('❌ Erro ao gerar QR Code.')
        }
      }

      state.next = 'gerarqrcode'
      return message.reply(menuQrcode)
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
  }
})

client.initialize()
