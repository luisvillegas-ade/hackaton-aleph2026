const process = require('bare-process')
const { colorize } = require('./ui.js')

const C = {
  reset: "\x1b[0m",
  clear: "\x1b[2J\x1b[H",
  hideCursor: "\x1b[?25l",
  showCursor: "\x1b[?25h"
}

let globalHandler = null

function setGlobalKeyHandler(handler) {
  globalHandler = handler
}

// Intercepts keypresses and handles raw mode
async function waitForKeys(handlers) {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true)
    }
    
    function onData(buf) {
      const hex = buf.toString('hex')
      // Ctrl+C
      if (hex === '03') {
        if (process.stdin.isTTY) process.stdin.setRawMode(false)
        process.stdout.write(C.showCursor)
        process.exit(130)
      }
      
      const key = buf.toString()
      let handled = false
      if (hex === '1b5b41') handled = handlers.up && handlers.up()
      else if (hex === '1b5b42') handled = handlers.down && handlers.down()
      else if (hex === '0d' || hex === '0a') handled = handlers.enter && handlers.enter()
      else if (hex === '1b') handled = handlers.escape && handlers.escape()
      else if (handlers.char) handled = handlers.char(key.toLowerCase())
      
      if (handled) {
        process.stdin.removeListener('data', onData)
        // Only disable raw mode if there is no global handler that might need it
        if (!globalHandler && process.stdin.isTTY) process.stdin.setRawMode(false)
        resolve()
      }
    }
    
    process.stdin.on('data', onData)
  })
}

// Global listener for background tasks (Activity Monitor)
function startGlobalListener() {
  if (process.stdin.isTTY) process.stdin.setRawMode(true)
  process.stdin.on('data', globalDataHandler)
}

function stopGlobalListener() {
  process.stdin.removeListener('data', globalDataHandler)
  if (process.stdin.isTTY) process.stdin.setRawMode(false)
}

function globalDataHandler(buf) {
  const hex = buf.toString('hex')
  if (hex === '03') {
    stopGlobalListener()
    process.stdout.write(C.showCursor)
    process.exit(130)
  }
  if (globalHandler) {
    globalHandler(buf.toString().toLowerCase())
  }
}

// Render a dashboard layout
function renderDashboard(title, content, commands) {
  process.stdout.write(C.clear)
  process.stdout.write(C.hideCursor)
  
  const width = 74
  const borderTop = `┌${'─'.repeat(width)}┐\n`
  const borderMid = `├${'─'.repeat(width)}┤\n`
  const borderBot = `└${'─'.repeat(width)}┘\n`
  
  let out = borderTop
  out += `│ ${title.padEnd(width - 1)}│\n`
  out += borderMid
  
  const lines = content.split('\n')
  for (const line of lines) {
    const cleanLen = line.replace(/\x1b\[[0-9;]*m/g, '').length
    const padding = Math.max(0, width - 1 - cleanLen)
    out += `│ ${line}${' '.repeat(padding)}│\n`
  }
  
  out += `│ ${''.padEnd(width-1)}│\n`
  out += `│ COMMANDS:${''.padEnd(width-10)}│\n`
  for (const cmd of commands) {
    const cleanCmdLen = cmd.replace(/\x1b\[[0-9;]*m/g, '').length
    out += `│ ${cmd}${' '.repeat(Math.max(0, width - 1 - cleanCmdLen))}│\n`
  }
  
  out += borderBot
  process.stdout.write(out)
}

async function promptConfirm(title, promptText, details = []) {
  stopGlobalListener()
  return new Promise(async (resolve) => {
    const render = (ans = '_') => {
      let content = details.join('\n')
      content += `\n\nSYSTEM PROMPT:\n${promptText} (Y/N): ${ans}`
      renderDashboard(
        colorize(title, 'neon'),
        content,
        [
          '[Y] Confirm and Push',
          '[N] Discard local changes'
        ]
      )
    }
    
    render()
    await waitForKeys({
      char: (c) => {
        if (c === 'y') {
          render('Y')
          setTimeout(() => resolve(true), 200)
          return true
        }
        if (c === 'n') {
          render('N')
          setTimeout(() => resolve(false), 200)
          return true
        }
        return false
      }
    })
    startGlobalListener()
  })
}

async function promptSelect(title, items) {
  stopGlobalListener()
  let selected = 0
  
  return new Promise(async (resolve) => {
    const render = () => {
      let content = ''
      items.forEach((item, i) => {
        const prefix = i === selected ? '> ' : '  '
        const suffix = i === selected ? '  <-- [SELECTED]' : ''
        content += `${prefix}${item.label}${suffix}\n`
      })
      
      renderDashboard(
        colorize(title, 'cyan'),
        content,
        [
          '[Enter] Import selected to Ableton /Samples/ folder',
          '[Esc] Return to Dashboard'
        ]
      )
    }
    
    render()
    await waitForKeys({
      up: () => {
        selected = Math.max(0, selected - 1)
        render()
        return false
      },
      down: () => {
        selected = Math.min(items.length - 1, selected + 1)
        render()
        return false
      },
      enter: () => {
        resolve(items[selected].value)
        return true
      },
      escape: () => {
        resolve(null)
        return true
      }
    })
    startGlobalListener()
  })
}

module.exports = {
  renderDashboard,
  promptConfirm,
  promptSelect,
  setGlobalKeyHandler,
  startGlobalListener,
  stopGlobalListener,
  C
}
