const Hyperswarm = require('hyperswarm')
const crypto = require('hypercore-crypto')

// El código de sala es una clave aleatoria de 32 bytes en hexadecimal.
// Se comparte una sola vez (WhatsApp, Telegram) y con eso alcanza:
// quien lo tiene entra a la sala, quien no lo tiene no puede ni encontrarla.
function newRoomCode() {
  return crypto.randomBytes(32).toString('hex')
}

function topicFromCode(code) {
  if (typeof code !== 'string' || !/^[0-9a-f]{64}$/i.test(code.trim())) {
    throw new Error('Código de sala inválido: se esperan 64 caracteres hexadecimales')
  }
  return Buffer.from(code.trim(), 'hex')
}

// Abre la sala y se queda escuchando. Devuelve el swarm para poder cerrarlo.
async function openRoom({ code, onJoin, onLeave }) {
  const swarm = new Hyperswarm()
  const topic = topicFromCode(code)

  swarm.on('connection', (socket, info) => {
    const id = info.publicKey.toString('hex').slice(0, 12)
    onJoin(id, swarm.connections.size)

    socket.on('close', () => onLeave(id, swarm.connections.size))
    // Sin este handler, un peer que se cae de golpe tira la app entera.
    socket.on('error', () => {})
  })

  const discovery = swarm.join(topic, { server: true, client: true })
  await discovery.flushed()

  return swarm
}

module.exports = { newRoomCode, topicFromCode, openRoom }
