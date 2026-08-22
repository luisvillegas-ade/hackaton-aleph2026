const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  neon: "\x1b[38;5;118m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
  red: "\x1b[31m"
}

function colorize(text, color) {
  return `${colors[color] || ''}${text}${colors.reset}`
}

function printLogo() {
  const logo = `
   ▄████▄   ██░ ██  ▄▄▄       ██ ▄█▀ ▄▄▄       ██▓
  ▒██▀ ▀█  ▓██░ ██▒▒████▄     ██▄█▒ ▒████▄    ▓██▒
  ▒▓█    ▄ ▒██▀▀██░▒██  ▀█▄  ▓███▄░ ▒██  ▀█▄  ▒██▒
  ▒▓▓▄ ▄██▒░▓█ ░██ ░██▄▄▄▄██ ▓██ █▄ ░██▄▄▄▄██ ░██░
  ▒ ▓███▀ ░░▓█▒░██▓ ▓█   ▓██▒▒██▒ █▄ ▓█   ▓██▒░██░
  ░ ░▒ ▒  ░ ▒ ░░▒░▒ ▒▒   ▓▒█░▒ ▒▒ ▓▒ ▒▒   ▓▒█░░▓  
    ░  ▒    ▒ ░▒░ ░  ▒   ▒▒ ░░ ░▒ ▒░  ▒   ▒▒ ░ ▒ ░
  ░         ░  ░░ ░  ░   ▒   ░ ░░ ░   ░   ▒    ▒ ░
  ░ ░       ░  ░  ░      ░  ░░  ░         ░  ░ ░  
  ░                                                
  `
  console.log(colorize(logo, 'neon'))
}

function printFrame(code) {
  const border = colorize('+' + '-'.repeat(66) + '+', 'magenta')
  const side = colorize('|', 'magenta')
  
  console.log(border)
  console.log(`${side} ${colorize(code, 'neon')} ${side}`)
  console.log(border)
}

function printSuccess(message) {
  console.log(colorize(`[+] ${message}`, 'green'))
}

function printInfo(message) {
  console.log(colorize(`[i] ${message}`, 'cyan'))
}

function printError(message) {
  console.log(colorize(`[x] ${message}`, 'red'))
}

function printMuted(message) {
  console.log(colorize(message, 'gray'))
}

// Dentro de WSL las rutas son /mnt/c/... pero el músico abre el proyecto
// desde Windows, donde eso no existe. Mostrar la forma que puede pegar en
// Reaper o en el explorador evita que tenga que traducirla a mano.
function toWindowsPath(p) {
  const m = /^\/mnt\/([a-z])\/(.*)$/i.exec(p)
  if (m === null) return null
  return `${m[1].toUpperCase()}:\\${m[2].split('/').join('\\')}`
}

// Ruta lista para abrir: la de Windows si estamos en WSL, la original si no.
function printPath(label, p) {
  const win = toWindowsPath(p)
  console.log(colorize(`  ${label} ${win || p}`, 'cyan'))
}

module.exports = {
  colorize,
  printLogo,
  printFrame,
  printSuccess,
  printInfo,
  printError,
  printMuted,
  toWindowsPath,
  printPath
}
