import { command, flag, summary, arg, rest } from 'paparam'
import { persistent } from 'bare-storage'
import process from 'bare-process'
import os from 'bare-os'
import { isWindows } from 'which-runtime'
import path from 'bare-path'
import pkg from './package.json'
import App from './app.js'
import { openRoom, parseCode, addFile, listFiles, downloadAll, humanSize } from './lib/room.js'

const appName = pkg.productName || pkg.name
const isDev = path.basename(Bare.argv[0]) === (isWindows ? 'bare.exe' : 'bare')

// Qué pidió el usuario. Se resuelve al parsear y se ejecuta recién
// después de que el updater esté listo, para no romper el OTA.
let action = null

const shareCmd = command(
  'share',
  summary('Abrir una sala y compartir archivos con la banda'),
  arg('<sala>', 'nombre de la canción o sesión'),
  rest('[...archivos]'),
  () => {
    action = {
      type: 'share',
      room: shareCmd.args.sala,
      files: shareCmd.rest || []
    }
  }
)

const joinCmd = command(
  'join',
  summary('Entrar a una sala y descargar lo que haya'),
  arg('<codigo>', 'código de la sala que te pasaron'),
  arg('[carpeta]', 'dónde guardar los archivos (por defecto ./chakai)'),
  () => {
    action = {
      type: 'join',
      code: joinCmd.args.codigo,
      target: joinCmd.args.carpeta || './chakai'
    }
  }
)

const cmd = command(
  appName,
  summary(pkg.description),
  flag('--version|-v', 'Print the current version'),
  flag('--storage <dir>', 'custom storage directory'),
  flag('--no-updates', 'disable OTA updates for this run'),
  shareCmd,
  joinCmd
)

cmd.parse(Bare.argv.slice(isDev ? 2 : 1))
if (cmd.flags.help) Bare.exit()
if (cmd.flags.version) {
  console.log(`${appName} v${pkg.version}`)
  Bare.exit()
}

const updates = cmd.flags.updates
const storage = cmd.flags.storage || (isDev ? null : path.join(persistent(), appName))
const dir = storage || path.join(os.tmpdir(), 'pear', appName)

// El updater guarda su estado en un Corestore con lock exclusivo sobre
// `dir`. Dos procesos no pueden tenerlo a la vez: el segundo revienta con
// "Corestore is closed" desde su worker, y como el error es asincrónico y
// vive en otro hilo, no hay try/catch que lo agarre — aborta el proceso.
//
// Como es normal tener varias salas abiertas al mismo tiempo (una por
// canción), el updater corre únicamente en la invocación sin comando:
// `chakai` a secas busca actualizaciones, y `share`/`join` se dedican a
// mover archivos. Así nunca compiten por el lock.
const wantsUpdater = action === null && updates !== false

console.log(`Updates: ${wantsUpdater ? 'enabled' : 'disabled'}`)

const app = wantsUpdater
  ? new App({
      dir,
      app: isDev ? null : os.execPath(),
      updates,
      version: pkg.version,
      upgrade: pkg.upgrade,
      name: isWindows ? appName + '.exe' : appName
    })
  : null

if (app !== null) {
  app.on('message', (message) => console.log(message))
  app.on('updating', () => console.log('[updater] getting new update'))
  app.on('updating-delta', (delta) => console.log('[updater]', delta))
  app.on('updated', () => console.log('[updater] update complete... applying'))
  app.on('update-applied', () =>
    console.log('[updater] applied update, restart to run latest version')
  )
  app.on('error', (err) => console.error('[app:error]', err.message))
}

let room = null

// Al salir hay que cerrar swarm y drive además del updater: si no, quedan
// conexiones abiertas y el proceso no termina.
async function shutdown(code) {
  if (room !== null) {
    const r = room
    room = null
    await r.swarm.destroy().catch(() => {})
    await r.drive.close().catch(() => {})
  }
  if (app !== null) await app.exit(code)
  else Bare.exit(code)
}

process.on('SIGHUP', () => shutdown(129))
process.on('SIGINT', () => shutdown(130))
process.on('SIGQUIT', () => shutdown(131))
process.on('SIGTERM', () => shutdown(143))

if (app !== null) await app.ready()

try {
  if (action === null) {
    console.log(`\n🎵 Chakai v${pkg.version} — stems y partituras entre la banda, sin servidor\n`)
    console.log('  chakai share <sala> [archivos...]   compartir con la banda')
    console.log('  chakai join <codigo> [carpeta]     descargar de una sala\n')
  } else if (action.type === 'share') {
    room = await openRoom({ storageDir: path.join(dir, 'rooms', action.room) })

    for (const file of action.files) {
      const { name, size } = await addFile(room.drive, file)
      console.log(`  + ${name} (${humanSize(size)})`)
    }

    const files = await listFiles(room.drive)
    console.log(`\n🎵 Sala "${action.room}" — ${files.length} archivo(s)\n`)
    console.log('Pasale este código a la banda:\n')
    console.log(`  ${room.drive.key.toString('hex')}\n`)
    console.log('Ellos lo bajan con:  chakai join <codigo>')
    console.log('\nCompartiendo. Dejá esta ventana abierta. Ctrl+C para cortar.\n')
  } else if (action.type === 'join') {
    const key = parseCode(action.code)
    room = await openRoom({
      storageDir: path.join(dir, 'joined', action.code.slice(0, 16)),
      key
    })

    console.log(`\n🎵 Conectando a la sala ${action.code.slice(0, 12)}...\n`)
    await room.drive.update()

    const saved = await downloadAll(room.drive, action.target)
    if (saved.length === 0) {
      console.log('  (todavía no hay archivos, o nadie está compartiendo ahora)\n')
    } else {
      for (const f of saved) console.log(`  ↓ ${f.name} (${humanSize(f.size)})`)
      console.log(`\nGuardado en ${action.target}\n`)
    }
    console.log('Sigo conectado para que otros puedan bajar de acá. Ctrl+C para cortar.\n')
  }
} catch (err) {
  // Errores del usuario (código mal pegado, archivo inexistente): mensaje
  // claro, sin volcado de pila.
  console.error(`\n✖ ${err.message}\n`)
  await shutdown(1)
}
