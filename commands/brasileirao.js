const axios = require('axios')
const { toZonedTime, format } = require('date-fns-tz')

async function jogoshoje() {
    try {
        const { data } = await axios.get('https://api.football-data.org/v4/competitions/BSA/matches', {
            headers: { 'X-Auth-Token': '18f9c31787b245c0b47573286ef9201d' }
        })

        const { matches } = data
        const timezone = 'America/Sao_Paulo'
        const now = new Date()

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
            return `⚽ Nenhum jogo hoje no Brasileirão.\n\n`
        }

        const hojeStr = format(now, 'yyyy-MM-dd', { timeZone: timezone })
        let resposta = `📅 Jogos de hoje no Brasileirão: ${hojeStr}\n`

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

        return resposta

    } catch (error) {
        console.error('Erro na API:', error.message)
        return `⚠️ Erro ao consultar os jogos.`
    }
}


async function tabela() {
    try {
        const { data } = await axios.get('https://api.football-data.org/v4/competitions/BSA/standings', {
            headers: { 'X-Auth-Token': '18f9c31787b245c0b47573286ef9201d' }
        })

        const { standings } = data
        let tabela = standings[0].table

        let resposta = '```'
        resposta += 'POS - TIME          - PTS - JGS\n'

        for (const time of tabela) {
            const posisao = String(time.position).padStart(3, ' ')
            const nome = time.team.shortName.padEnd(13, ' ').toUpperCase()
            const pontos = String(time.points).padEnd(3, ' ')
            const jogos = String(time.playedGames).padEnd(3, ' ')
            resposta += `${posisao} - ${nome} - ${pontos} - ${jogos}\n`
        }
        resposta += '```'
        return resposta
    } catch (error) {
        console.error('Erro na API:', error.message)
        return `⚠️ Erro ao consultar a próxima rodada.`
    }
}



async function proxrodada() {
    try {
        const { data } = await axios.get('https://api.football-data.org/v4/competitions/BSA/matches', {
            headers: { 'X-Auth-Token': '18f9c31787b245c0b47573286ef9201d' }
        })
        const { matches } = data
        const proxRodada = matches[0].season.currentMatchday + 1
        const proximaRodada = matches.filter(m => m.matchday === proxRodada)
        if (proximaRodada.length === 0) {
            return message.reply(`⚽ Nenhum jogo encontrado para a próxima rodada.\n`)
        }
        let resposta = `📅 Próxima rodada do Brasileirão: Rodada ${proxRodada}\n──────────────\n`
        for (const jogo of proximaRodada) {
            const timezone = 'America/Sao_Paulo'
            const timeCasa = jogo.homeTeam.shortName
            const timeFora = jogo.awayTeam.shortName
            const localDate = toZonedTime(new Date(jogo.utcDate), timezone)
            const horario = format(localDate, 'HH:mm', { timeZone: timezone })
            const dataFormatada = format(localDate, 'dd/MM/yyyy', { timeZone: timezone })
            if (jogo.status === 'FINISHED') {
                resposta += `📅 ${dataFormatada} - Finalizado\n${timeCasa} ${jogo.score.fullTime.home} x ${jogo.score.fullTime.away} ${timeFora}\n──────────────\n`
            } else {
                resposta += `📅 ${dataFormatada} - ${horario}\n${timeCasa} x ${timeFora}\n──────────────\n`
            }
        }
        return resposta
    } catch (error) {
        console.error('Erro na API:', error.message)
        return `⚠️ Erro ao consultar a próxima rodada.`
    }
}

module.exports = { proxrodada, tabela, jogoshoje }