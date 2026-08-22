const fs = require('bare-fs')
const path = require('bare-path')

// `drive.version` sube una vez por archivo escrito, así que una sola tanda de
// guardado del DAW puede mover la versión de 4 a 15. Ese número no le sirve a
// nadie. Por eso llevamos aparte un historial de "tomas": cada toma agrupa
// todos los archivos que cambiaron juntos, con su fecha y su versión real del
// drive, que es la que después usa `restore`.
//
// El historial vive dentro del propio drive, así que viaja a toda la banda.
const HISTORY_PATH = '/.chakai/history.json'

// Se excluye del contenido del proyecto: es metadata nuestra, no del músico.
function isInternal(drivePath) {
  return drivePath.startsWith('/.chakai/')
}

async function readHistory(drive) {
  try {
    const raw = await drive.get(HISTORY_PATH)
    if (raw === null) return []
    const parsed = JSON.parse(raw.toString())
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function appendTake(drive, { files, removed = [] }) {
  const history = await readHistory(drive)
  const take = {
    n: history.length + 1,
    version: drive.version, // estado del drive con los archivos ya escritos
    at: new Date().toISOString(),
    files,
    removed
  }
  history.push(take)
  await drive.put(HISTORY_PATH, Buffer.from(JSON.stringify(history, null, 2)))
  return take
}

// Escribe en disco el contenido del proyecto tal como estaba en una toma.
async function restoreTake(drive, take, targetDir) {
  const snapshot = drive.checkout(take.version)
  const written = []
  try {
    await fs.promises.mkdir(targetDir, { recursive: true })
    for await (const entry of snapshot.list('/')) {
      if (isInternal(entry.key)) continue
      const data = await snapshot.get(entry.key)
      if (data === null) continue

      const rel = entry.key.replace(/^\//, '')
      const dest = path.join(targetDir, ...rel.split('/'))
      await fs.promises.mkdir(path.dirname(dest), { recursive: true })
      await fs.promises.writeFile(dest, data)
      written.push({ name: rel, size: data.length })
    }
  } finally {
    await snapshot.close()
  }
  return written
}

function formatDate(iso) {
  const d = new Date(iso)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

module.exports = { HISTORY_PATH, isInternal, readHistory, appendTake, restoreTake, formatDate }
