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

// Un proyecto de DAW (Ableton, Reaper) no es un archivo: es un árbol de
// carpetas, y si se pierde la estructura el proyecto no abre del otro lado.
// Por eso se conserva la ruta relativa completa dentro del drive.
async function walk(root, rel = '') {
  const out = []
  const entries = await fs.promises.readdir(path.join(root, rel), { withFileTypes: true })
  for (const entry of entries) {
    const childRel = rel ? path.join(rel, entry.name) : entry.name
    if (entry.isDirectory()) out.push(...(await walk(root, childRel)))
    else out.push(childRel)
  }
  return out
}

// Las rutas del drive son siempre con "/", aunque el sistema use "\".
function toDrivePath(p) {
  return '/' + p.split(path.sep).join('/')
}

// Acepta tanto un archivo suelto como una carpeta entera. En el caso de la
// carpeta, se cuelga todo de su nombre para que el receptor obtenga la
// carpeta del proyecto lista para abrir, no sus tripas sueltas.
async function addPath(drive, srcPath) {
  const clean = srcPath.replace(/[/\\]+$/, '')
  const stat = await fs.promises.stat(clean)

  if (!stat.isDirectory()) {
    const data = await fs.promises.readFile(clean)
    const name = path.basename(clean)
    await drive.put('/' + name, data)
    return [{ name, size: data.length }]
  }

  const base = path.basename(clean)
  const files = await walk(clean)
  const added = []
  for (const rel of files) {
    const data = await fs.promises.readFile(path.join(clean, rel))
    await drive.put(toDrivePath(path.join(base, rel)), data)
    added.push({ name: toDrivePath(path.join(base, rel)).slice(1), size: data.length })
  }
  return added
}

async function listFiles(drive) {
  const out = []
  for await (const entry of drive.list('/')) {
    out.push({ name: entry.key.replace(/^\//, ''), key: entry.key })
  }
  return out
}

async function downloadAll(drive, targetDir, onProgress = null) {
  await fs.promises.mkdir(targetDir, { recursive: true })
  const saved = []
  for await (const entry of drive.list('/')) {
    const data = await drive.get(entry.key)
    if (data === null) continue

    const rel = entry.key.replace(/^\//, '')
    const dest = path.join(targetDir, ...rel.split('/'))
    // Recrear los subdirectorios: sin esto, un proyecto de DAW llega plano
    // y no abre.
    await fs.promises.mkdir(path.dirname(dest), { recursive: true })
    await fs.promises.writeFile(dest, data)
    const fileInfo = { name: rel, size: data.length }
    saved.push(fileInfo)
    if (onProgress) onProgress(fileInfo)
  }
  return saved
}

function humanSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}

module.exports = { openRoom, parseCode, addPath, listFiles, downloadAll, humanSize }
