const { test } = require('brittle')
const { parse, serialize, merge, trackMap } = require('../lib/rpp.js')

// Un .rpp mínimo pero con la forma real: bloques anidados, cada pista con
// su GUID, y el proyecto cerrado por un ">" al final.
function proyecto(guids) {
  const lineas = ['<REAPER_PROJECT 0.1 "7.77/win64" 1787429362 0', '  RIPPLE 0 0']
  for (const [guid, nombre] of guids) {
    lineas.push(`  <TRACK {${guid}}`, `    NAME "${nombre}"`, '    VOLPAN 1 0 -1 -1 1', '  >')
  }
  lineas.push('>')
  return lineas.join('\r\n')
}

const BASE = 'AAAAAAAA-0000-0000-0000-000000000001'
const BAJO = 'BBBBBBBB-0000-0000-0000-000000000002'
const VOZ = 'CCCCCCCC-0000-0000-0000-000000000003'

test('parsea y vuelve a serializar sin alterar el archivo', (t) => {
  const original = proyecto([[BASE, 'guia']])
  t.is(serialize(parse(original)), original)
})

test('reconoce cada pista por su GUID', (t) => {
  const doc = parse(
    proyecto([
      [BASE, 'guia'],
      [BAJO, 'bajo']
    ])
  )
  t.is(trackMap(doc).size, 2)
  t.ok(trackMap(doc).has(BAJO))
})

test('dos musicos graban pistas distintas: quedan las dos', (t) => {
  const mia = proyecto([
    [BASE, 'guia'],
    [BAJO, 'bajo']
  ])
  const suya = proyecto([
    [BASE, 'guia'],
    [VOZ, 'voz']
  ])

  const r = merge(mia, suya)

  t.is(r.added.length, 1, 'se suma solo la pista que faltaba')
  t.is(r.conflicts.length, 0, 'pistas distintas no son conflicto')
  t.is(trackMap(parse(r.text)).size, 3, 'guia + bajo + voz')
  t.ok(r.text.includes('NAME "bajo"'))
  t.ok(r.text.includes('NAME "voz"'))
})

test('fusionar dos veces no duplica: la operación converge', (t) => {
  const mia = proyecto([
    [BASE, 'guia'],
    [BAJO, 'bajo']
  ])
  const suya = proyecto([
    [BASE, 'guia'],
    [VOZ, 'voz']
  ])

  const primera = merge(mia, suya)
  const segunda = merge(primera.text, suya)

  t.is(segunda.added.length, 0, 'ya no hay nada nuevo que sumar')
  t.is(trackMap(parse(segunda.text)).size, 3, 'sigue habiendo 3 pistas')
})

test('si los dos tocaron la misma pista se avisa y gana la propia', (t) => {
  const mia = proyecto([[BAJO, 'bajo con distorsion']])
  const suya = proyecto([[BAJO, 'bajo limpio']])

  const r = merge(mia, suya)

  t.is(r.conflicts.length, 1, 'se reporta el conflicto')
  t.is(r.added.length, 0, 'no se agrega una pista duplicada')
  t.ok(r.text.includes('bajo con distorsion'), 'se conserva la propia')
  t.absent(r.text.includes('bajo limpio'), 'la ajena no pisa la propia')
})

test('conserva los saltos de linea de Windows', (t) => {
  const mia = proyecto([[BASE, 'guia']])
  const suya = proyecto([
    [BASE, 'guia'],
    [VOZ, 'voz']
  ])
  t.ok(merge(mia, suya).text.includes('\r\n'))
})

test('rechaza un archivo que no termina como un .rpp valido', (t) => {
  t.exception(() => parse('<REAPER_PROJECT 0.1\r\n  RIPPLE 0 0'))
})
