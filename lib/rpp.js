// Fusión de proyectos de Reaper (.rpp) a nivel de pista.
//
// Un .rpp es texto plano con bloques anidados: una línea que empieza con "<"
// abre un bloque y una línea que es solo ">" lo cierra. Cada pista es un
// bloque <TRACK {GUID}>, y ese GUID es único y estable.
//
// Eso es lo que hace posible fusionar de verdad: si el bajista agrega la
// pista {A} y la cantante la {B}, el resultado es el proyecto con las dos.
// Solo hay conflicto real cuando dos personas tocaron la MISMA pista.

const TRACK_RE = /^\s*<TRACK\s+\{([0-9A-Fa-f-]+)\}/

// Divide el cuerpo del proyecto en trozos: cada trozo es una línea suelta
// (una configuración) o un bloque completo (una pista, las notas, etc.).
function splitChunks(lines) {
  const chunks = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (line.trim().startsWith('<')) {
      // bloque: acumular hasta que cierre, contando anidamiento
      const start = i
      let depth = 0
      do {
        const t = lines[i].trim()
        if (t.startsWith('<')) depth++
        else if (t === '>') depth--
        i++
      } while (i < lines.length && depth > 0)

      const text = lines.slice(start, i)
      const m = TRACK_RE.exec(lines[start])
      chunks.push(
        m
          ? { type: 'track', guid: m[1].toUpperCase(), lines: text }
          : { type: 'block', lines: text }
      )
      continue
    }

    chunks.push({ type: 'line', lines: [line] })
    i++
  }

  return chunks
}

function parse(text) {
  const eol = text.includes('\r\n') ? '\r\n' : '\n'
  const lines = text.split(/\r?\n/)

  // La última línea con contenido es el ">" que cierra <REAPER_PROJECT
  let end = lines.length - 1
  while (end > 0 && lines[end].trim() === '') end--
  if (lines[end].trim() !== '>') {
    throw new Error('El archivo .rpp no termina como se espera; no se puede fusionar con seguridad')
  }

  return {
    eol,
    header: lines[0],
    chunks: splitChunks(lines.slice(1, end)),
    footer: lines.slice(end)
  }
}

function serialize(doc) {
  const out = [doc.header]
  for (const ch of doc.chunks) out.push(...ch.lines)
  out.push(...doc.footer)
  return out.join(doc.eol)
}

function trackMap(doc) {
  const m = new Map()
  for (const ch of doc.chunks) if (ch.type === 'track') m.set(ch.guid, ch)
  return m
}

function sameLines(a, b) {
  return a.length === b.length && a.every((l, i) => l === b[i])
}

// Fusiona el proyecto de otro músico sobre el propio.
//
// - Las pistas que solo tiene el otro se agregan.
// - Las que solo tenés vos se conservan.
// - Si los dos tocaron la misma pista y quedó distinta, gana la tuya y se
//   informa el conflicto: preferimos avisar antes que pisar trabajo ajeno
//   en silencio.
// - El resto de la configuración (zoom, cursor, ventanas) se toma de la
//   tuya, porque es preferencia personal y no contenido musical.
function merge(mineText, theirsText) {
  const mine = parse(mineText)
  const theirs = parse(theirsText)

  const mineTracks = trackMap(mine)
  const theirTracks = trackMap(theirs)

  const added = []
  const conflicts = []

  for (const [guid, chunk] of theirTracks) {
    const own = mineTracks.get(guid)
    if (!own) {
      mine.chunks.push(chunk)
      added.push(guid)
    } else if (!sameLines(own.lines, chunk.lines)) {
      conflicts.push(guid)
    }
  }

  return { text: serialize(mine), added, conflicts, total: mineTracks.size + added.length }
}

module.exports = { parse, serialize, merge, trackMap }
