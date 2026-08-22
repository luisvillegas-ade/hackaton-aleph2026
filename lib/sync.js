const fs = require('bare-fs')
const path = require('bare-path')
const { merge: mergeRpp } = require('./rpp.js')
const { isInternal } = require('./versions.js')

// Resuelve la unión de todos los drives sobre la carpeta local.
//
// Reglas, en orden:
//  - Archivo que no tenemos          -> se escribe.
//  - Archivo igual al nuestro        -> no se toca.
//  - Proyecto de Reaper (.rpp)       -> se fusiona por pista.
//  - Cualquier otro archivo distinto -> se guarda al lado, sin pisar.
//
// La regla de oro es no perder trabajo ajeno nunca: ante la duda, se
// conservan las dos versiones y se avisa.

function sameBytes(a, b) {
  if (a.length !== b.length) return false
  return a.equals ? a.equals(b) : Buffer.compare(a, b) === 0
}

function withSuffix(relPath, suffix) {
  const dir = path.dirname(relPath)
  const base = path.basename(relPath)
  const dot = base.lastIndexOf('.')
  const name = dot > 0 ? base.slice(0, dot) : base
  const ext = dot > 0 ? base.slice(dot) : ''
  const nuevo = `${name} (${suffix})${ext}`
  return dir === '.' ? nuevo : path.join(dir, nuevo)
}

async function readIfExists(p) {
  try {
    return await fs.promises.readFile(p)
  } catch {
    return null
  }
}

// Aplica lo que trae el drive de un par sobre la carpeta local.
async function applyPeer(drive, folder, { peerLabel, onEvent }) {
  const results = []

  for await (const entry of drive.list('/')) {
    if (isInternal(entry.key)) continue

    const rel = entry.key.replace(/^\//, '')
    const dest = path.join(folder, ...rel.split('/'))
    const incoming = await drive.get(entry.key)
    if (incoming === null) continue

    const current = await readIfExists(dest)

    if (current === null) {
      await fs.promises.mkdir(path.dirname(dest), { recursive: true })
      await fs.promises.writeFile(dest, incoming)
      results.push({ rel, action: 'nuevo', size: incoming.length })
      if (onEvent) onEvent({ rel, action: 'nuevo', size: incoming.length })
      continue
    }

    if (sameBytes(current, incoming)) continue

    if (rel.toLowerCase().endsWith('.rpp')) {
      try {
        const r = mergeRpp(current.toString('utf8'), incoming.toString('utf8'))

        // Si ya tenemos todas sus pistas, no hay nada que hacer. Este corte
        // es lo que hace que la ida y vuelta entre pares converja en vez de
        // rebotar para siempre.
        if (r.added.length === 0 && r.conflicts.length === 0) continue

        // La fusión va sobre EL MISMO archivo del proyecto. Antes se escribía
        // una copia "(fusionado)" al lado, y eso partía el proyecto en dos:
        // el músico trabajaba sobre la copia, sus cambios no se publicaban y
        // encima se los pisaba la siguiente fusión. Un solo archivo, siempre.
        if (r.added.length > 0) {
          await fs.promises.writeFile(dest, r.text)
        }

        // Si los dos tocaron la misma pista, la versión del otro se guarda
        // aparte para no perderla: en la propia gana la nuestra.
        if (r.conflicts.length > 0) {
          const theirRel = withSuffix(rel, `de ${peerLabel}`)
          const theirDest = path.join(folder, ...theirRel.split('/'))
          await fs.promises.writeFile(theirDest, incoming)
        }

        const info = {
          rel,
          action: 'fusionado',
          added: r.added.length,
          conflicts: r.conflicts.length
        }
        results.push(info)
        if (onEvent) onEvent(info)
        continue
      } catch (err) {
        // Si el .rpp no se puede fusionar, se conserva igual como copia.
        if (onEvent) onEvent({ rel, action: 'error-fusion', message: err.message })
      }
    }

    // Distinto y no fusionable: se conserva al lado, nunca se pisa.
    const copyRel = withSuffix(rel, `de ${peerLabel}`)
    const copyDest = path.join(folder, ...copyRel.split('/'))
    await fs.promises.mkdir(path.dirname(copyDest), { recursive: true })
    await fs.promises.writeFile(copyDest, incoming)
    const info = { rel: copyRel, action: 'copia', size: incoming.length }
    results.push(info)
    if (onEvent) onEvent(info)
  }

  return results
}

// Sube a mi propio drive lo que cambió en mi carpeta.
async function publishLocal(drive, folder, relPaths) {
  const out = []
  for (const rel of relPaths) {
    // Las copias de respaldo de un conflicto ajeno no se re-publican: son
    // un resguardo local, no trabajo propio. El proyecto en sí (el .rpp
    // fusionado en su lugar) sí se publica: es lo que hace que el trabajo
    // de cada uno llegue al resto.
    if (/\(de [^)]+\)\.[^.]+$/.test(rel)) continue
    try {
      const data = await fs.promises.readFile(path.join(folder, rel))
      await drive.put('/' + rel.split(path.sep).join('/'), data)
      out.push({ rel, size: data.length })
    } catch {
      // archivo borrado entre la detección y la lectura
    }
  }
  return out
}

module.exports = { applyPeer, publishLocal, withSuffix }
