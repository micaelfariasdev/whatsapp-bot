from flask import Flask, render_template, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import requests

app = Flask(__name__)

# Configuração do banco de dados SQLite
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///rifa.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# Modelo para as informações da Rifa


class Rifa(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    premio = db.Column(db.String(100), nullable=False)
    valor_ponto = db.Column(db.Float, nullable=False)
    data_sorteio = db.Column(db.String(50), nullable=False)
    total_pontos = db.Column(db.Integer, nullable=False,
                             default=100)  # Adicionado de volta

# Modelo para o status dos números


class Numero(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    numero = db.Column(db.Integer, unique=True, nullable=False)
    status = db.Column(db.String(20), default='available', nullable=False)
    nome_comprador = db.Column(db.String(100))
    whatsapp_comprador = db.Column(db.String(20))
    data_reserva = db.Column(db.DateTime)


# Cria as tabelas do banco de dados se elas não existirem
with app.app_context():
    db.create_all()

    # Popula o banco de dados com dados iniciais se estiver vazio
    if not Rifa.query.first():
        rifa_inicial = Rifa(
            premio='Prêmio Incrível!',
            valor_ponto=10.00,
            data_sorteio='20 de Novembro de 2025',
            total_pontos=10  # Adicionado para evitar erro
        )
        db.session.add(rifa_inicial)
        db.session.commit()

    if not Numero.query.first():
        for i in range(1, 11):
            novo_numero = Numero(numero=i)  # Valor agora é um inteiro
            db.session.add(novo_numero)
        db.session.commit()

# Rota principal para a landing page


@app.route('/')
def index():
    rifa = Rifa.query.first()
    numeros = Numero.query.all()
    return render_template('index.html', rifa=rifa, numeros=numeros)

# Rota para criar ou atualizar as informações da rifa


@app.route('/api/rifa', methods=['POST'])
def atualizar_rifa():
    data = request.json
    rifa = Rifa.query.first()

    # Pega o novo total de pontos da requisição, se houver
    novo_total_pontos = data.get('total_pontos')

    if rifa:
        # Se o novo total de pontos for fornecido E for menor que o atual
        if novo_total_pontos is not None and novo_total_pontos < rifa.total_pontos:
            return jsonify({'error': 'O total de pontos não pode ser menor que o valor atual.'}), 400

        # Lógica para adicionar novos números se o total aumentar
        if novo_total_pontos is not None and novo_total_pontos > rifa.total_pontos:
            for i in range(rifa.total_pontos + 1, novo_total_pontos + 1):
                novo_numero = Numero(numero=i)  # Convertido para int
                db.session.add(novo_numero)

        # Atualiza as informações da rifa
        rifa.premio = data.get('premio', rifa.premio)
        rifa.valor_ponto = data.get('valor_ponto', rifa.valor_ponto)
        rifa.total_pontos = novo_total_pontos if novo_total_pontos is not None else rifa.total_pontos
        rifa.data_sorteio = data.get('data_sorteio', rifa.data_sorteio)

    else:
        # Se a rifa não existe, crie uma nova e todos os seus números
        if not all(k in data for k in ['premio', 'valor_ponto', 'total_pontos', 'data_sorteio']):
            return jsonify({'error': 'Dados incompletos para criar a rifa.'}), 400

        rifa = Rifa(
            premio=data['premio'],
            valor_ponto=data['valor_ponto'],
            total_pontos=data['total_pontos'],
            data_sorteio=data['data_sorteio']
        )
        db.session.add(rifa)

        for i in range(1, rifa.total_pontos + 1):
            novo_numero = Numero(numero=i)  # Convertido para int
            db.session.add(novo_numero)

    db.session.commit()
    return jsonify({'mensagem': 'Informações da rifa e números atualizados com sucesso!'})
# Rota para reservar um número


@app.route('/api/reservar', methods=['POST'])
def reservar_numero():
    data = request.json
    numero_str = data.get('numero')
    nome = data.get('nome')
    whatsapp = data.get('whatsapp')

    if not all([numero_str, nome, whatsapp]):
        return jsonify({'error': 'Dados incompletos'}), 400

    try:
        numero_int = int(numero_str)
    except (ValueError, TypeError):
        return jsonify({'error': 'O número deve ser um valor numérico válido.'}), 400

    numero = Numero.query.filter_by(numero=numero_int).first()

    if numero and numero.status == 'available':
        # 1. Atualiza o banco de dados
        numero.status = 'reserved'
        numero.nome_comprador = nome
        numero.whatsapp_comprador = whatsapp
        numero.data_reserva = datetime.utcnow()
        db.session.commit()
        
        # 2. Envia a mensagem para o bot do WhatsApp
        try:
            # Endereço da API do seu bot do WhatsApp
            # Altere a porta se o seu bot estiver rodando em outra
            bot_api_url = 'http://127.0.0.1:3000/reserva'
            
            # Dados a serem enviados ao bot
            payload = {
                "mensagem":f'''✅Nova Venda✅
Número Reservado: {numero_str},
Nome: {nome},
Whatsapp: {whatsapp}'''
            }
            
            # Faz a requisição POST para a API do bot
            response = requests.post(bot_api_url, json=payload)
            response.raise_for_status() # Lança um erro para respostas HTTP ruins
            
            print('Mensagem enviada com sucesso para o bot.')

        except requests.exceptions.RequestException as e:
            # Em caso de erro, apenas o loga, sem impedir a reserva
            print(f'Erro ao enviar mensagem para o bot do WhatsApp: {e}')
            
        return jsonify({'mensagem': f'Número {numero_str} reservado com sucesso!'})
    else:
        return jsonify({'error': f'Número {numero_str} não está disponível para reserva.'}), 409

# Rota para obter o status de todos os números


@app.route('/api/numeros')
def get_numeros():
    numeros = Numero.query.all()
    numeros_list = [
        {'numero': n.numero, 'status': n.status,
            'nome': n.nome_comprador, 'whatsapp': n.whatsapp_comprador}
        for n in numeros
    ]
    return jsonify(numeros_list)

@app.route('/api/confirmado', methods=['POST'])
def confirmar_numero():
    data = request.json
    id = data.get('id')

    if not id:
        return jsonify({'error': 'ID não fornecido'}), 400

    numero_rifa = Numero.query.filter_by(numero=id).first()

    if numero_rifa:
        if  numero_rifa.status == 'reserved':
            numero_rifa.status = 'sold'
            db.session.commit()
            return jsonify({'mensagem': f'Número {numero_rifa.numero} confirmado com sucesso!'}), 200
        else:
            return jsonify({'error': f'Número {numero_rifa.numero} não está disponível para confirmação.'}), 409
    else:
        return jsonify({'error': f'Número com ID {id} não encontrado.'}), 404


if __name__ == '__main__':
    app.run(debug=True, port=5000)
