const axios = require('axios')
const { toZonedTime, format } = require('date-fns-tz')

async function evangelho() {
    try {
        const { data } = await axios.get(`https://liturgia.up.railway.app/v2/`)
        const ev = data.leituras.evangelho[0]

        let resposta = `
📖 *Evangelho do Dia* - ${data.data}
🕊️ ${data.liturgia}

📍 ${ev.referencia}
${ev.titulo}

"${ev.texto}"
      `.trim()

        return resposta
    } catch (error) {
        console.error('Erro na API:', error.message)
        state.state = 'inicio'
        return `⚠️ Erro ao consultar a API.`
    }
}

module.exports = { evangelho }