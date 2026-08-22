const Hyperdrive = require('hyperdrive')
const Corestore = require('corestore')
const Hyperswarm = require('hyperswarm')
const fs = require('bare-fs')
const path = require('bare-path')

// Una sala es un Hyperdrive: un sistema de archivos que se replica entre pares.
// Quien la crea es el que puede escribir; los demás la abren con la clave
// pública y descargan. El código que se comparte ES la clave del drive.
//
// El swarm se une a la discoveryKey (un hash de la clave pública), así que
// alguien que espía la red no puede deducir la clave real a partir del topic.
async function openRoom({ storageDir, key = null }) {
  const store = new Corestore(storageDir)
  const drive = key ? new Hyperdrive(store, key) : new Hyperdrive(store)
  await drive.ready()

  const swarm = new Hyperswarm()

  // findingPeers() frena las lecturas hasta terminar de buscar pares; sin esto
  // una descarga puede fallar por preguntar antes de tener a quién preguntarle.
  const done = drive.findingPeers()
  swarm.on('connection', (socket) => {
    socket.on('error', () => {})
    drive.replicate(socket)
  })
  swarm.join(drive.discoveryKey)
  swarm.flush().then(done, done)

  return { store, drive, swarm }
}

function parseCode(code) {
  const clean = String(code || '').trim()
  if (!/^[0-9a-f]{64}$/i.test(clean)) {
    throw new Error('Código de sala inválido: se esperan 64 caracteres hexadecimales')
  }
  return Buffer.from(clean, 'hex')
}

async function addFile(drive, filePath) {
  const name = path.basename(filePath)
  const data = await fs.promises.readFile(filePath)
  await drive.put('/' + name, data)
  return { name, size: data.length }
}

async function listFiles(drive) {
  const out = []
  for await (const entry of drive.list('/')) {
    out.push({ name: path.basename(entry.key), key: entry.key })
  }
  return out
}

async function downloadAll(drive, targetDir) {
  await fs.promises.mkdir(targetDir, { recursive: true })
  const saved = []
  for await (const entry of drive.list('/')) {
    const data = await drive.get(entry.key)
    if (data === null) continue
    const name = path.basename(entry.key)
    await fs.promises.writeFile(path.join(targetDir, name), data)
    saved.push({ name, size: data.length })
  }
  return saved
}

function humanSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}

module.exports = { openRoom, parseCode, addFile, listFiles, downloadAll, humanSize }
