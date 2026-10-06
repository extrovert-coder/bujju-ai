import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')

const isWindows = process.platform === 'win32'

// ANSI Color codes
const colors = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  magenta: '\x1b[35m',
  red: '\x1b[31m',
  bold: '\x1b[1m',
}

console.log(`${colors.cyan}${colors.bold}====================================================${colors.reset}`)
console.log(`${colors.green}${colors.bold}            🚀 Launching Bujju AI 🚀               ${colors.reset}`)
console.log(`${colors.cyan}${colors.bold}====================================================${colors.reset}`)
console.log(`${colors.yellow}Starting Express backend (port 5000) and Vite frontend...${colors.reset}\n`)

function runCommand(name, color, fullCommand) {
  const child = spawn(fullCommand, {
    cwd: rootDir,
    stdio: ['inherit', 'pipe', 'pipe'],
    shell: true,
  })

  child.stdout?.on('data', (data) => {
    const lines = data.toString().split('\n')
    for (const line of lines) {
      if (line.trim()) {
        console.log(`${color}[${name}]${colors.reset} ${line}`)
      }
    }
  })

  child.stderr?.on('data', (data) => {
    const lines = data.toString().split('\n')
    for (const line of lines) {
      if (line.trim()) {
        console.error(`${colors.red}[${name} ERR]${colors.reset} ${line}`)
      }
    }
  })

  child.on('close', (code) => {
    if (code !== 0 && code !== null) {
      console.log(`${colors.red}[${name}] exited with code ${code}${colors.reset}`)
    }
  })

  return child
}

// Start backend
const backend = runCommand('Backend', colors.magenta, 'node server/index.js')

// Start frontend
const frontend = runCommand('Frontend', colors.cyan, 'npm run dev')

// Graceful cleanup on SIGINT / SIGTERM
const cleanup = () => {
  console.log(`\n${colors.yellow}Stopping Bujju AI services...${colors.reset}`)
  try {
    if (isWindows) {
      if (backend?.pid) spawn('taskkill', ['/pid', backend.pid.toString(), '/f', '/t'], { shell: false })
      if (frontend?.pid) spawn('taskkill', ['/pid', frontend.pid.toString(), '/f', '/t'], { shell: false })
    } else {
      backend.kill('SIGINT')
      frontend.kill('SIGINT')
    }
  } catch {
    // Ignore cleanup errors
  }
  process.exit(0)
}

process.on('SIGINT', cleanup)
process.on('SIGTERM', cleanup)
