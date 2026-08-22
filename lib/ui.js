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
  const border = colorize('╔' + '═'.repeat(66) + '╗', 'magenta')
  const borderBottom = colorize('╚' + '═'.repeat(66) + '╝', 'magenta')
  const side = colorize('║', 'magenta')
  
  console.log(border)
  console.log(`${side} ${colorize(code, 'neon')} ${side}`)
  console.log(borderBottom)
}

function printSuccess(message) {
  console.log(colorize(`✔ ${message}`, 'green'))
}

function printInfo(message) {
  console.log(colorize(`ℹ ${message}`, 'cyan'))
}

function printError(message) {
  console.log(colorize(`✖ ${message}`, 'red'))
}

function printMuted(message) {
  console.log(colorize(message, 'gray'))
}

module.exports = {
  colorize,
  printLogo,
  printFrame,
  printSuccess,
  printInfo,
  printError,
  printMuted
}
