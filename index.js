const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');
const fetch = require('node-fetch'); // Importa o node-fetch

const app = express();
const port = 3000;

// Middleware para processar requisições JSON
app.use(express.json());

// Inicialização do cliente do WhatsApp
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
      '--disable-gpu',
    ],
  },
  webVersionCache: {
    type: 'remote',
    remotePath:
      'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html',
  },
});

client.on('qr', (qr) => qrcode.generate(qr, { small: true }));

client.on('ready', () => {
  console.log('Bot pronto!');
  app.listen(port, '0.0.0.0', () => {
    console.log(`Servidor Express rodando na porta ${port}`);
  });
  client.sendMessage('558681569018@c.us', 'Bot pronto!');
});

client.on('message', async (message) => {
  const text = message.body.trim().toLowerCase();

  if (message.from.endsWith('120363420117493479@g.us')) {
  }
  // Verifica se a mensagem veio de um grupo
  if (message.from.endsWith('@g.us')) {
    // Comando !oi
    if (text.startsWith('!oi')) {
      return message.reply('oi');
    }

    if (text.startsWith('!atualizar_rifa')) {
      console.log('enviando');
      const args = message.body.trim().split('\n');

      // Verifica se o número de argumentos está correto
      if (args.length !== 5) {
        return message.reply(`Uso incorreto do comando.\nFormato:
!atualizar_rifa
<Prêmio>
<Valor do Ponto>
<Total de Pontos>
<Data do Sorteio>`);
      }

      const premio = args[1].trim().split(':')[1];
      const valorPonto = parseFloat(args[2].trim().split(':')[1]);
      const totalPontos = parseInt(args[3].trim().split(':')[1]);
      const dataSorteio = args[4].trim().split(':')[1];

      if (isNaN(valorPonto) || isNaN(totalPontos)) {
        return message.reply(
          'Valor do ponto e total de pontos devem ser números.'
        );
      }

      try {
        const response = await fetch('https://rifa.micaelfarias.com/api/rifa', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            premio: premio,
            valor_ponto: valorPonto,
            total_pontos: totalPontos,
            data_sorteio: dataSorteio,
          }),
        });

        if (response.ok) {
          const result = await response.json();
          return message.reply(`✅ ${result.mensagem}`);
        } else {
          const error = await response.json();
          return message.reply(
            `❌ Erro ao atualizar a rifa: ${error.error || response.statusText}`
          );
        }
      } catch (error) {
        console.error('Erro ao conectar com o servidor Flask:', error);
        return message.reply(
          '❌ Ocorreu um erro ao tentar atualizar a rifa. Verifique se o servidor Flask está rodando.'
        );
      }
    }

    if (text.startsWith('!confirme')) {
      const text2 = String(text);
      const tes = text2.replace(' ', '/');
      const partes = tes.split('/');
      const numeroParaConfirmar = partes[1];

      if (!numeroParaConfirmar) {
        message.reply(
          'Por favor, forneça um número para confirmar. Ex: !confirme/12'
        );
        return;
      }

      // URL da sua API Flask
      const flaskApiUrl = 'https://rifa.micaelfarias.com/api/confirmado';

      try {
        // Monta o payload (os dados a serem enviados no POST)
        const payload = {
          id: parseInt(numeroParaConfirmar),
        };

        // Faz a requisição POST para a sua API Flask
        const response = await fetch(flaskApiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        // Verifica se a resposta foi bem-sucedida antes de tentar converter para JSON
        if (response.ok) {
          const result = await response.json();
          message.reply(`✅ ${result.mensagem}`);
        } else {
          const error = await response.json();
          message.reply(
            `❌ Erro ao confirmar o número: ${
              error.error || response.statusText
            }`
          );
        }
      } catch (error) {
        // Se a requisição falhar, pega a mensagem de erro
        const erroApi = 'Erro ao conectar com a API da rifa.';
        console.error('Erro na requisição para o Flask:', error);
        message.reply(
          `❌ Ocorreu um erro ao tentar confirmar o número. Verifique se o servidor Flask está rodando.`
        );
      }
    }

    if (text.startsWith('!numeros')) {
      try {
        const response = await fetch(
          'https://rifa.micaelfarias.com/api/numeros',
          {
            method: 'GET',
          }
        );

        if (response.ok) {
          const numeros = await response.json();
          const sold = numeros
            .filter((item) => item.status === 'sold')
            .map((i) => i.numero);
          const available = numeros
            .filter((i) => i.status === 'available')
            .map((i) => i.numero);
          const reserved = numeros
            .filter((i) => i.status === 'reserved')
            .map((i) => i.numero);
          message.reply(
            `Numeros vendidos são: ${sold.join(
              ', '
            )}\nNumeros reservados são: ${reserved.join(
              ', '
            )}\nNumeros disponiveis são: ${available.join(', ')}`
          );
        } else {
          console.error(
            'Erro na requisição:',
            response.status,
            response.statusText
          );
        }
      } catch (error) {
        console.error('Ocorreu um erro:', error);
      }
    }

    if (text.startsWith('!reservados')) {
      try {
        const response = await fetch(
          'https://rifa.micaelfarias.com/api/numeros',
          {
            method: 'GET',
          }
        );

        if (response.ok) {
          const numeros = await response.json();
          const reservedList = numeros.filter(
            (item) => item.status === 'reserved'
          );
          var msg = '🟠 Números reservados 🟠\n';
          for (var n of reservedList) {
            msg += '---------------------------\n';
            msg += `Nome: ${n.nome}\nZap: ${n.whatsapp}\nNúmero do ponto:  ${n.numero}\n`;
          }
          message.reply(msg);
        } else {
          console.error(
            'Erro na requisição:',
            response.status,
            response.statusText
          );
        }
      } catch (error) {
        console.error('Ocorreu um erro:', error);
      }
    }

    if (text.startsWith('!remover')) {
      const text2 = String(text);
      const partes = text2.split('/');
      const numeroParaRemover = partes[1];

      if (!numeroParaRemover) {
        message.reply(
          'Por favor, forneça um número para remover. Ex: !remover/12'
        );
        return;
      }

      const flaskApiUrl = 'https://rifa.micaelfarias.com/api/remove';

      try {
        const payload = {
          id: parseInt(numeroParaRemover),
        };

        const response = await fetch(flaskApiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          const result = await response.json();
          message.reply(`✅ ${result.mensagem}`);
        } else {
          const error = await response.json();
          message.reply(
            `❌ Erro ao remover o número: ${error.error || response.statusText}`
          );
        }
      } catch (error) {
        console.error('Erro na requisição para o Flask:', error);
        message.reply(
          '❌ Ocorreu um erro ao tentar remover o número. Verifique se o servidor Flask está rodando.'
        );
      }
    }

    // Comando !info
    if (text.startsWith('!info')) {
      const chat = await message.getChat();

      // Certifica-se de que é um grupo
      if (chat.isGroup) {
        const participantes = chat.participants.length;
        const nomeDoGrupo = chat.name;
        const criacao = new Date(chat.createdAt).toLocaleDateString('pt-BR');
        const descricao = chat.description || 'Nenhuma descrição.';

        // Monta a mensagem de resposta
        const info = `
*--- Informações do Grupo ---*
*Nome:* ${nomeDoGrupo}
*ID do Grupo:* ${chat.id._serialized}
*Total de Membros:* ${participantes}
*Data de Criação:* ${criacao}
*Descrição:* ${descricao}
`;
        return message.reply(info.trim());
      } else {
        return message.reply('Este comando só pode ser usado em grupos.');
      }
    }
  }
});

// A rota Express precisa ser definida antes da inicialização
app.post('/enviar-mensagem', (req, res) => {
  const { numero, mensagem } = req.body;
  if (!numero || !mensagem) {
    return res
      .status(400)
      .json({ error: 'Número e mensagem são obrigatórios.' });
  }
  client
    .sendMessage(`${numero}@c.us`, mensagem)
    .then((response) => {
      console.log('Mensagem enviada com sucesso:', response.id._serialized);
      res
        .status(200)
        .json({ success: true, message: 'Mensagem enviada com sucesso!' });
    })
    .catch((err) => {
      console.error('Erro ao enviar mensagem:', err);
      res
        .status(500)
        .json({ error: 'Falha ao enviar a mensagem.', details: err });
    });
});

app.post('/reserva', (req, res) => {
  const { mensagem } = req.body;
  if (!mensagem) {
    return res
      .status(400)
      .json({ error: 'Número e mensagem são obrigatórios.' });
  }
  client
    .sendMessage(`120363420117493479@g.us`, mensagem)
    .then((response) => {
      console.log('Mensagem enviada com sucesso:', response.id._serialized);
      res
        .status(200)
        .json({ success: true, message: 'Mensagem enviada com sucesso!' });
    })
    .catch((err) => {
      console.error('Erro ao enviar mensagem:', err);
      res
        .status(500)
        .json({ error: 'Falha ao enviar a mensagem.', details: err });
    });
});

// Inicialização do cliente
client.initialize();
