const fs = require('bare-fs')
const path = require('bare-path')

// Recorre la carpeta y devuelve una firma por archivo (tamaño + fecha de
// modificación). Comparar dos recorridos alcanza para saber qué cambió, sin
// depender de fs.watch, que en Bare es territorio incierto.
async function scan(root, rel = '', out = new Map()) {
  let entries
  try {
    entries = await fs.promises.readdir(path.join(root, rel), { withFileTypes: true })
  } catch {
    return out // la carpeta desapareció mientras mirábamos
  }

  for (const entry of entries) {
    const childRel = rel ? path.join(rel, entry.name) : entry.name
    if (entry.isDirectory()) {
      await scan(root, childRel, out)
      continue
    }
    try {
      const st = await fs.promises.stat(path.join(root, childRel))
      out.set(childRel, `${st.size}:${Math.floor(st.mtimeMs)}`)
    } catch {
      // archivo borrado entre el readdir y el stat: se ignora
    }
  }
  return out
}

function compare(prev, next) {
  const changed = []
  const removed = []
  for (const [p, sig] of next) if (prev.get(p) !== sig) changed.push(p)
  for (const p of prev.keys()) if (!next.has(p)) removed.push(p)
  return { changed, removed }
}

// Un DAW guarda en ráfagas: el .als, después los samples, después el índice.
// Si tomáramos una foto en cada escritura saldrían decenas de versiones
// basura, y encima alguna con archivos a medio escribir. Por eso se espera a
// que pase un ciclo entero sin movimiento antes de dar por cerrado el cambio.
function watchFolder(root, { intervalMs = 3000, onSnapshot }) {
  let previous = null
  let pendingChanged = new Set()
  let pendingRemoved = new Set()
  let busy = false

  const timer = setInterval(async () => {
    if (busy) return
    busy = true
    try {
      const current = await scan(root)

      if (previous === null) {
        previous = current
        return
      }

      const { changed, removed } = compare(previous, current)
      previous = current

      if (changed.length > 0 || removed.length > 0) {
        for (const p of changed) pendingChanged.add(p)
        for (const p of removed) pendingRemoved.add(p)
        return // todavía se está escribiendo: esperamos a que se calme
      }

      if (pendingChanged.size > 0 || pendingRemoved.size > 0) {
        const batch = {
          changed: [...pendingChanged],
          removed: [...pendingRemoved]
        }
        pendingChanged = new Set()
        pendingRemoved = new Set()
        await onSnapshot(batch)
      }
    } catch {
      // un ciclo fallido no debe cortar la vigilancia
    } finally {
      busy = false
    }
  }, intervalMs)

  return () => clearInterval(timer)
}

module.exports = { scan, compare, watchFolder }
