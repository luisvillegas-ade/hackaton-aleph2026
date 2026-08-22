import { command, flag, summary, arg, rest } from 'paparam'
import { persistent } from 'bare-storage'
import process from 'bare-process'
import fs from 'bare-fs'
import os from 'bare-os'
import { isWindows } from 'which-runtime'
import path from 'bare-path'
import pkg from './package.json'
import App from './app.js'
import {
  openRoom,
  parseCode,
  addPath,
  addOne,
  removeOne,
  listFiles,
  downloadAll,
  humanSize
} from './lib/room.js'
import { watchFolder, scan } from './lib/watch.js'
import { newSessionCode, openSession, closeSession } from './lib/session.js'
import sessionCrypto from 'hypercore-crypto'
import { applyPeer, publishLocal } from './lib/sync.js'
import { readHistory, appendTake, restoreTake, formatDate } from './lib/versions.js'
import ui from './lib/ui.js'

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

const logCmd = command(
  'log',
  summary('Ver el historial de tomas de una sala'),
  arg('<sala>', 'nombre de la sala'),
  () => {
    action = { type: 'log', room: logCmd.args.sala }
  }
)

const restoreCmd = command(
  'restore',
  summary('Volver el proyecto a una toma anterior'),
  arg('<sala>', 'nombre de la sala'),
  arg('<toma>', 'número de toma (se ve con: chakai log)'),
  arg('[carpeta]', 'dónde escribirla (por defecto ./chakai-restore)'),
  () => {
    action = {
      type: 'restore',
      room: restoreCmd.args.sala,
      take: Number(restoreCmd.args.toma),
      target: restoreCmd.args.carpeta || './chakai-restore'
    }
  }
)

const openCmd = command(
  'open',
  summary('Trabajar en equipo: todos escriben, todos reciben'),
  arg('<carpeta>', 'la carpeta del proyecto'),
  arg('[codigo]', 'código de una sesión existente; sin él se crea una nueva'),
  () => {
    action = {
      type: 'open',
      folder: openCmd.args.carpeta,
      code: openCmd.args.codigo || null
    }
  }
)

const cmd = command(
  appName,
  summary(pkg.description),
  flag('--version|-v', 'Print the current version'),
  flag('--storage <dir>', 'custom storage directory'),
  flag('--no-updates', 'disable OTA updates for this run'),
  openCmd,
  shareCmd,
  joinCmd,
  logCmd,
  restoreCmd
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
let session = null

// Al salir hay que cerrar swarm y drives además del updater: si no, quedan
// conexiones abiertas y el proceso no termina.
async function shutdown(code) {
  if (room !== null) {
    const r = room
    room = null
    await r.swarm.destroy().catch(() => {})
    await r.drive.close().catch(() => {})
  }
  if (session !== null) {
    const s = session
    session = null
    await closeSession(s)
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
    ui.printLogo()
    ui.printInfo(`Chakai v${pkg.version} — control de versiones para proyectos musicales\n`)
    ui.printMuted('  chakai open <carpeta> [codigo]         TRABAJO EN EQUIPO: todos escriben')
    console.log('')
    ui.printMuted('  chakai share <sala> <carpeta>          compartir y vigilar cambios')
    ui.printMuted('  chakai join <codigo> [carpeta]         bajar y quedar sincronizado')
    ui.printMuted('  chakai log <sala>                      ver el historial de tomas')
    ui.printMuted('  chakai restore <sala> <toma> [dest]    volver a una toma anterior\n')
  } else if (action.type === 'open') {
    const code = action.code || newSessionCode()
    const folder = action.folder.replace(/[/\\]+$/, '')

    // El almacenamiento se deriva del código Y de la carpeta local. Si solo
    // dependiera del código, dos ventanas de la misma máquina en la misma
    // sesión chocarían por el lock — que es exactamente el caso de una demo
    // o de alguien participando desde dos proyectos distintos.
    const slot = sessionCrypto.data(Buffer.from(code + '|' + folder)).toString('hex').slice(0, 16)

    session = await openSession({
      storageDir: path.join(dir, 'sesiones', slot),
      code,
      onPeer: (hex, total) => ui.printSuccess(`se sumó ${hex.slice(0, 8)} (${total} en la sala)`)
    })

    // Publicar lo que ya hay en la carpeta
    const inicial = await scan(folder)
    const subidos = await publishLocal(session.mine, folder, [...inicial.keys()])
    for (const f of subidos) ui.printSuccess(`+ ${f.rel} (${humanSize(f.size)})`)

    console.log('')
    ui.printPath('carpeta:', folder)
    console.log('')
    if (action.code) {
      ui.printInfo(`Sesión abierta — ${subidos.length} archivo(s) tuyos publicados\n`)
    } else {
      ui.printInfo(`Sesión nueva — ${subidos.length} archivo(s) publicados\n`)
      ui.printMuted('Pasale este código a la banda:')
      ui.printFrame(code)
      ui.printMuted('Ellos entran con:  chakai open <su-carpeta> <codigo>')
      console.log('')
    }

    // Lo que yo guardo se publica en MI drive
    watchFolder(folder, {
      onSnapshot: async ({ changed }) => {
        const pub = await publishLocal(session.mine, folder, changed)
        if (pub.length === 0) return
        for (const f of pub) ui.printSuccess(`↑ ${f.rel} (${humanSize(f.size)})`)
        const take = await appendTake(session.mine, { files: pub.map((f) => f.rel) })
        ui.printInfo(`toma #${take.n} publicada\n`)
      }
    })

    // Lo que guardan los demás baja y se resuelve sobre mi carpeta
    const vistos = new Map()
    setInterval(async () => {
      for (const [hex, drive] of session.peers) {
        try {
          await drive.update({ wait: true })
          if (vistos.get(hex) === drive.version) continue
          vistos.set(hex, drive.version)

          await applyPeer(drive, folder, {
            peerLabel: hex.slice(0, 6),
            onEvent: (e) => {
              if (e.action === 'nuevo') ui.printSuccess(`↓ ${e.rel} (${humanSize(e.size)})`)
              else if (e.action === 'fusionado') {
                ui.printInfo(`⇉ ${e.rel} — ${e.added} pista(s) sumada(s)`)
                if (e.conflicts > 0) {
                  ui.printMuted(`   ${e.conflicts} pista(s) tocadas por los dos: se conservó la tuya`)
                }
                // Es el archivo que el músico va a querer abrir: se muestra
                // en el formato que puede pegar en Reaper sin traducirlo.
                ui.printPath('abrilo en:', path.join(folder, ...e.rel.split('/')))
              } else if (e.action === 'copia') ui.printMuted(`   guardado aparte: ${e.rel}`)
              else if (e.action === 'error-fusion') ui.printError(`no se pudo fusionar ${e.rel}`)
            }
          })
        } catch {
          // un par caído no corta la sesión
        }
      }
    }, 4000)

    ui.printInfo('Trabajando en equipo. Lo que guardes se publica solo. Ctrl+C para salir.\n')
  } else if (action.type === 'share') {
    room = await openRoom({ storageDir: path.join(dir, 'rooms', action.room) })

    const firstTake = []
    for (const target of action.files) {
      const added = await addPath(room.drive, target)
      for (const f of added) ui.printSuccess(`+ ${f.name} (${humanSize(f.size)})`)
      firstTake.push(...added.map((f) => f.name))
    }
    if (firstTake.length > 0) {
      const take = await appendTake(room.drive, { files: firstTake })
      ui.printMuted(`  toma #${take.n} guardada`)
    }

    const files = await listFiles(room.drive)
    console.log('')
    ui.printInfo(`Sala "${action.room}" — ${files.length} archivo(s)\n`)
    ui.printMuted('Pasale este código a la banda:')
    ui.printFrame(room.drive.key.toString('hex'))
    ui.printMuted('Ellos lo bajan con:  chakai join <codigo>')
    console.log('')

    // Vigilar las carpetas compartidas: cuando el músico guarda en el DAW,
    // se registra una toma nueva sola, sin que tenga que acordarse de nada.
    const stops = []
    for (const target of action.files) {
      const clean = target.replace(/[/\\]+$/, '')
      let isDir = false
      try {
        isDir = (await fs.promises.stat(clean)).isDirectory()
      } catch {}
      if (!isDir) continue

      const baseName = path.basename(clean)
      stops.push(
        watchFolder(clean, {
          onSnapshot: async ({ changed, removed }) => {
            const touched = []
            for (const rel of changed) {
              try {
                const f = await addOne(room.drive, clean, baseName, rel)
                touched.push(f.name)
                ui.printSuccess(`~ ${f.name} (${humanSize(f.size)})`)
              } catch {}
            }
            for (const rel of removed) {
              const f = await removeOne(room.drive, baseName, rel)
              ui.printMuted(`  - ${f.name}`)
            }
            if (touched.length === 0 && removed.length === 0) return
            const take = await appendTake(room.drive, {
              files: touched,
              removed: removed.map((r) => path.join(baseName, r))
            })
            ui.printInfo(`toma #${take.n} — ${formatDate(take.at)}\n`)
          }
        })
      )
    }
    if (stops.length > 0) {
      ui.printMuted('Vigilando cambios: cuando guardes en el DAW se registra una toma sola.')
    }

    ui.printInfo('Compartiendo. Dejá esta ventana abierta. Ctrl+C para cortar.\n')
  } else if (action.type === 'log') {
    room = await openRoom({ storageDir: path.join(dir, 'rooms', action.room) })
    const history = await readHistory(room.drive)
    console.log('')
    if (history.length === 0) {
      ui.printMuted('  Todavía no hay tomas en esta sala.\n')
    } else {
      ui.printInfo(`Historial de "${action.room}" — ${history.length} toma(s)\n`)
      for (const t of history.slice().reverse()) {
        ui.printSuccess(`#${t.n}  ${formatDate(t.at)}`)
        for (const f of t.files.slice(0, 6)) ui.printMuted(`     ~ ${f}`)
        if (t.files.length > 6) ui.printMuted(`     … y ${t.files.length - 6} más`)
        for (const f of (t.removed || []).slice(0, 3)) ui.printMuted(`     - ${f}`)
      }
      console.log('')
      ui.printMuted(`Para volver a una:  chakai restore ${action.room} <numero>`)
      console.log('')
    }
    await shutdown(0)
  } else if (action.type === 'restore') {
    room = await openRoom({ storageDir: path.join(dir, 'rooms', action.room) })
    const history = await readHistory(room.drive)
    const take = history.find((t) => t.n === action.take)
    if (!take) {
      throw new Error(
        `No existe la toma #${action.take} en "${action.room}". Miralas con: chakai log ${action.room}`
      )
    }
    console.log('')
    ui.printInfo(`Recuperando la toma #${take.n} del ${formatDate(take.at)}...\n`)
    const written = await restoreTake(room.drive, take, action.target)
    for (const f of written) ui.printSuccess(`↺ ${f.name} (${humanSize(f.size)})`)
    console.log('')
    ui.printSuccess(`Escrito en ${action.target}\n`)
    await shutdown(0)
  } else if (action.type === 'join') {
    const key = parseCode(action.code)
    room = await openRoom({
      storageDir: path.join(dir, 'joined', action.code.slice(0, 16)),
      key
    })

    console.log('')
    ui.printInfo(`Conectando a la sala ${action.code.slice(0, 12)}...\n`)
    await room.drive.update()

    const saved = await downloadAll(room.drive, action.target, (f) => {
      ui.printSuccess(`↓ ${f.name} (${humanSize(f.size)})`)
    })
    
    if (saved.length === 0) {
      ui.printMuted('  (todavía no hay archivos, o nadie está compartiendo ahora)\n')
    } else {
      console.log('')
      ui.printSuccess(`Guardado en ${action.target}\n`)
    }

    // Quedarse escuchando: si del otro lado registran una toma nueva, se baja
    // sola. Hyperdrive transfiere solo los bloques que cambiaron, así que
    // volver a bajar no reenvía el proyecto entero.
    let known = room.drive.version
    setInterval(async () => {
      try {
        await room.drive.update({ wait: true })
        if (room.drive.version === known) return
        known = room.drive.version

        const nuevos = await downloadAll(room.drive, action.target)
        console.log('')
        ui.printInfo('Llegó una toma nueva:')
        for (const f of nuevos) ui.printSuccess(`↓ ${f.name} (${humanSize(f.size)})`)
        console.log('')
      } catch {
        // un ciclo fallido no debe cortar la sincronización
      }
    }, 4000)

    ui.printInfo('Sincronizando. Lo que guarden del otro lado te llega solo. Ctrl+C para cortar.\n')
  }
} catch (err) {
  // Errores del usuario (código mal pegado, archivo inexistente): mensaje
  // claro, sin volcado de pila.
  console.log('')
  ui.printError(err.message)
  console.log('')
  await shutdown(1)
}
