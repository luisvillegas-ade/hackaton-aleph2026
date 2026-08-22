const Hyperswarm = require('hyperswarm')
const Corestore = require('corestore')
const Hyperdrive = require('hyperdrive')
const Protomux = require('protomux')
const c = require('compact-encoding')
const crypto = require('hypercore-crypto')

// Una sesión colaborativa: cada músico tiene SU propio drive y escribe solo
// ahí. Al conectarse, los pares se pasan sus claves por un canal aparte
// montado sobre la misma conexión que usa la replicación.
//
// La ventaja de este diseño sobre un drive compartido es que los conflictos
// de escritura son imposibles: nadie escribe donde escribe otro. Lo que ve
// cada uno es la unión de todos los drives, y esa unión se resuelve al
// escribir en disco, no en la red.

function newSessionCode() {
  return crypto.randomBytes(32).toString('hex')
}

// El código es secreto compartido: sin él no se puede ni encontrar la sesión.
// Se deriva el topic por hash para no anunciar el código en claro en la DHT.
function topicFor(code) {
  return crypto.data(Buffer.from('chakai/room/' + code))
}

async function openSession({ storageDir, code, onPeer }) {
  const store = new Corestore(storageDir)
  const mine = new Hyperdrive(store)
  await mine.ready()

  const peers = new Map() // hex de la clave -> Hyperdrive de solo lectura
  const swarm = new Hyperswarm()

  swarm.on('connection', (socket) => {
    socket.on('error', () => {})

    // El mismo socket lleva la replicación de datos y nuestro protocolo de
    // registro. Protomux es lo que permite compartirlo sin pisarse.
    const mux = Protomux.from(socket)
    store.replicate(socket)

    const channel = mux.createChannel({ protocol: 'chakai/registry' })
    if (channel === null) return

    const message = channel.addMessage({
      encoding: c.fixed32,
      onmessage: async (key) => {
        const hex = key.toString('hex')
        if (hex === mine.key.toString('hex') || peers.has(hex)) return
        try {
          const theirs = new Hyperdrive(store, key)
          await theirs.ready()
          peers.set(hex, theirs)
          if (onPeer) onPeer(hex, peers.size)
        } catch {
          // un par que no responde no debe cortar la sesión
        }
      }
    })

    channel.open()
    message.send(mine.key)
  })

  swarm.join(topicFor(code), { server: true, client: true })
  const done = mine.findingPeers()
  swarm.flush().then(done, done)

  return { store, mine, peers, swarm }
}

async function closeSession(session) {
  await session.swarm.destroy().catch(() => {})
  for (const d of session.peers.values()) await d.close().catch(() => {})
  await session.mine.close().catch(() => {})
}

module.exports = { newSessionCode, topicFor, openSession, closeSession }
