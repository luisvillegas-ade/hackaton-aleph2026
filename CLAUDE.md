# CLAUDE.md

Guía para trabajar sobre este repositorio con asistentes de código.

## Proyecto

**Chakai** — control de versiones y colaboración para proyectos musicales, sin servidor. Varios músicos abren el mismo proyecto de DAW, cada uno graba lo suyo, y los aportes se fusionan a nivel de pista.

Construido sobre el stack de Holepunch, partiendo del template `hello-pear-bare` (variante `main`).

## Lo primero que hay que saber

**Bare no es Node.js.** No existen `fs`, `path` ni `process` de Node: se usan `bare-fs`, `bare-path`, `bare-process`. Cualquier paquete de npm puede no funcionar. Antes de usar una API, verificarla contra el paquete instalado en `node_modules`, no de memoria — el código con métodos inventados es el error más caro acá.

## Comandos

```sh
npm start -- open <carpeta> [codigo]   # sesión colaborativa
npm start -- share <sala> <carpeta>    # distribución de uno a muchos
npm start -- join <codigo> [carpeta]   # recibir y sincronizar
npm start -- log <sala>                # historial de tomas
npm start -- restore <sala> <toma>     # volver a una toma anterior

npm run make                           # binario del sistema actual
npm run make:win32-x64                 # o una plataforma específica
```

## Arquitectura

| Archivo                   | Responsabilidad                                                                 |
| ------------------------- | ------------------------------------------------------------------------------- |
| `bin.mjs`                 | Comandos y orquestación                                                         |
| `lib/session.js`          | Sesión multi-escritura: un drive por músico, intercambio de claves por protomux |
| `lib/sync.js`             | Resuelve la unión de todos los drives sobre la carpeta local                    |
| `lib/rpp.js`              | Fusión de proyectos Reaper por pista (GUID)                                     |
| `lib/room.js`             | Replicación y archivos (modo `share`/`join`)                                    |
| `lib/watch.js`            | Detección de cambios por sondeo, con espera de calma                            |
| `lib/versions.js`         | Historial de tomas                                                              |
| `lib/ui.js`, `lib/tui.js` | Salida por terminal                                                             |
| `workers/main.js`         | Una línea: `require('hello-pear-worker')`, el updater OTA                       |

### Decisiones que conviene no revertir sin entender

- **Un drive por músico.** Nadie escribe donde escribe otro, así que los conflictos de escritura son imposibles por diseño. La unión se resuelve al escribir en disco.
- **El updater corre solo en la invocación sin comando.** Toma un lock exclusivo sobre su Corestore; si dos ventanas lo levantan, la segunda aborta con `Corestore is closed` desde su worker — un error asincrónico de otro hilo que ningún `try/catch` atrapa.
- **La fusión de `.rpp` va sobre el mismo archivo**, no en una copia al lado. Una copia partía el proyecto en dos y el músico terminaba trabajando sobre un archivo que se le sobrescribía.
- **Detección de cambios por sondeo**, no `fs.watch` (incierto en Bare). Se espera un ciclo sin movimiento antes de cerrar una toma, porque los DAW guardan en ráfagas.

## Publicar una versión

La copia de deploy no debe usar `git pull` (el `npm install` de cada plataforma modifica `package-lock.json` y lo bloquea en silencio):

```sh
git fetch origin main && git reset --hard origin/main
node -p "require('./package.json').version"   # verificar ANTES de compilar
```

Después compilar las seis plataformas, `pear build` y `pear stage`. El `pear seed` tiene que estar corriendo para que alguien pueda instalar.
