const axios = require('axios')

async function cnpj(x) {
    try {
        const { data } = await axios.get(`https://brasilapi.com.br/api/cnpj/v1/${x}`)

        if (data.length === 0) {
            return `Empresa não encontrada.\n\n`
        } else {
            var resposta = `📑 *Dados do CNPJ* - ${data.nome_fantasia}\n`
            resposta += `*Razão Social:* ${data.razao_social}\n`
            resposta += `*CNPJ:* ${data.cnpj}\n`
            resposta += `*Endereço:* ${data.logradouro} ${data.numero} - ${data.cep}, ${data.municipio}-${data.uf}\n`
            resposta += `*Porte:* ${data.porte}\n`
            resposta += `*Atividade Principal:* ${data.cnae_fiscal_descricao}\n`
        }

        return resposta

    } catch (error) {
        console.error('Erro na API:', error.message)
        return `⚠️ Erro ao consultar o CNPJ.`
    }
}


module.exports = { cnpj }