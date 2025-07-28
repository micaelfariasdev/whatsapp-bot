#!/bin/bash

# Caminhos e configurações
ARQUIVO=index.js
CHAVE=~/chave2.key
DESTINO=ubuntu@64.181.171.161
PASTA_REMOTA=~/whatsapp-bot/

# Copiar arquivo para o servidor
scp -i "$CHAVE" "$ARQUIVO" "$DESTINO:$PASTA_REMOTA"

# Reiniciar o processo remoto via PM2
ssh -i "$CHAVE" "$DESTINO" 'pm2 restart all'
