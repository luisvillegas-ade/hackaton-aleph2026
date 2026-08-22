import { command, flag, summary, arg } from 'paparam'
import { persistent } from 'bare-storage'
import process from 'bare-process'
import os from 'bare-os'
import { isWindows } from 'which-runtime'
import path from 'bare-path'
import pkg from './package.json'
import App from './app.js'
import { newRoomCode, openRoom } from './lib/room.js'

const appName = pkg.productName || pkg.name
const isDev = path.basename(Bare.argv[0]) === (isWindows ? 'bare.exe' : 'bare')

// Qué pidió el usuario. Se resuelve al parsear y se ejecuta recién
// después de que el updater esté listo, para no romper el OTA.
let action = null

const createCmd = command(
  'create',
  summary('Crear una sala nueva para una canción'),
  () => {
    action = { type: 'create' }
  }
)

const joinCmd = command(
  'join',
  summary('Entrar a una sala existente'),
  arg('<codigo>', 'código de la sala que te pasaron'),
  () => {
    action = { type: 'join', code: joinCmd.args.codigo }
  }
)

const cmd = command(
  appName,
  summary(pkg.description),
  flag('--version|-v', 'Print the current version'),
  flag('--storage <dir>', 'custom storage directory'),
  flag('--no-updates', 'disable OTA updates for this run'),
  createCmd,
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

console.log(`Updates: ${updates === false ? 'disabled' : 'enabled'}`)

const app = new App({
  dir,
  app: isDev ? null : os.execPath(),
  updates,
  version: pkg.version,
  upgrade: pkg.upgrade,
  name: isWindows ? appName + '.exe' : appName
})

app.on('message', (message) => console.log(message))
app.on('updating', () => console.log('[updater] getting new update'))
app.on('updating-delta', (delta) => console.log('[updater]', delta))
app.on('updated', () => console.log('[updater] update complete... applying'))
app.on('update-applied', () =>
  console.log('[updater] applied update, restart to run latest version')
)
app.on('error', (err) => console.error('[app:error]', err))

let swarm = null

// Al salir hay que cerrar el swarm además del updater: si no, quedan
// conexiones abiertas y el proceso no termina.
async function shutdown(code) {
  if (swarm !== null) {
    const s = swarm
    swarm = null
    await s.destroy().catch(() => {})
  }
  await app.exit(code)
}

process.on('SIGHUP', () => shutdown(129))
process.on('SIGINT', () => shutdown(130))
process.on('SIGQUIT', () => shutdown(131))
process.on('SIGTERM', () => shutdown(143))

try {
  await app.ready()

  if (action === null) {
    console.log('\nUsá "create" para abrir una sala o "join <codigo>" para entrar a una.')
    console.log('Ctrl+C para salir.\n')
  } else {
    const code = action.type === 'create' ? newRoomCode() : action.code

    if (action.type === 'create') {
      console.log('\n🎵 Sala creada.\n')
      console.log('Pasale este código a la banda:\n')
      console.log(`  ${code}\n`)
      console.log('Ellos entran con:  chakai join <codigo>\n')
    } else {
      console.log(`\n🎵 Entrando a la sala ${code.slice(0, 12)}...\n`)
    }

    swarm = await openRoom({
      code,
      onJoin: (id, total) => console.log(`  + se conectó ${id} (${total} en línea)`),
      onLeave: (id, total) => console.log(`  - se fue ${id} (${total} en línea)`)
    })

    console.log('Sala abierta. Esperando a los demás. Ctrl+C para salir.\n')
  }
} catch (err) {
  console.error('[app:error]', err)
  await app.close().finally(() => Bare.exit(1))
}
