const { nativeImage, shell } = require('electron')
const fs = require('node:fs')
const { spawn } = require('node:child_process')
const http = require('node:http')
const https = require('node:https')

const MAX_ICON_INPUT_BYTES = 2 * 1024 * 1024
const MAX_ICON_OUTPUT_BYTES = 120 * 1024

function commandShell (command) {
  if (process.platform === 'win32') {
    return { executable: process.env.ComSpec || 'cmd.exe', args: ['/d', '/s', '/c', command] }
  }
  if (process.platform === 'darwin') {
    return { executable: '/bin/zsh', args: ['-lc', command] }
  }
  if (fs.existsSync('/bin/bash')) {
    return { executable: '/bin/bash', args: ['-lc', command] }
  }
  return { executable: '/bin/sh', args: ['-c', command] }
}

function shellQuote (value) {
  return `'${String(value).replace(/'/g, `'"'"'`)}'`
}

function commandEnvironment (value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(Object.entries(value)
    .filter(([key, entry]) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(key) && typeof entry === 'string')
    .slice(0, 30))
}

function spawnDetached (executable, args, options = {}) {
  return new Promise((resolve) => {
    let settled = false
    let startedTimer
    const child = spawn(executable, args, {
      detached: true,
      stdio: 'ignore',
      windowsHide: false,
      ...options
    })

    child.once('spawn', () => {
      startedTimer = setTimeout(() => {
        if (settled) return
        settled = true
        child.unref()
        resolve(success({ pid: child.pid, shell: executable, platform: process.platform }))
      }, 400)
    })
    child.once('error', (error) => {
      if (settled) return
      clearTimeout(startedTimer)
      settled = true
      resolve(failure(error))
    })
    child.once('exit', (code) => {
      if (settled) return
      clearTimeout(startedTimer)
      settled = true
      resolve(code === 0
        ? success({ pid: child.pid, shell: executable, platform: process.platform })
        : failure(`命令已退出，代码 ${code}`))
    })
  })
}

function runCommandInTerminal (command, options) {
  const environment = commandEnvironment(options.environment)
  const cwd = options.workingDirectory || undefined
  const childEnvironment = { ...process.env, ...environment }

  if (process.platform === 'darwin') {
    const environmentPrefix = Object.entries(environment)
      .map(([key, value]) => `${key}=${shellQuote(value)}`)
      .join(' ')
    const terminalCommand = [cwd ? `cd ${shellQuote(cwd)}` : '', environmentPrefix ? `${environmentPrefix} ${command}` : command]
      .filter(Boolean)
      .join(' && ')
    return spawnDetached('/usr/bin/osascript', [
      '-e',
      `tell application "Terminal" to do script ${JSON.stringify(terminalCommand)}`
    ], { env: childEnvironment })
  }

  if (process.platform === 'win32') {
    const executable = process.env.ComSpec || 'cmd.exe'
    return spawnDetached(executable, ['/d', '/s', '/c', `start "" cmd.exe /k ${command}`], {
      cwd,
      env: childEnvironment
    })
  }

  const terminal = ['/usr/bin/x-terminal-emulator', '/usr/bin/gnome-terminal', '/usr/bin/konsole']
    .find((candidate) => fs.existsSync(candidate))
  if (!terminal) return Promise.resolve(failure('未找到可用的终端应用，请改用后台运行'))
  const selectedShell = commandShell(command)
  const args = terminal.endsWith('gnome-terminal')
    ? ['--', selectedShell.executable, ...selectedShell.args]
    : ['-e', selectedShell.executable, ...selectedShell.args]
  return spawnDetached(terminal, args, { cwd, env: childEnvironment })
}

function imageDataUrl (buffer) {
  const header = buffer.subarray(0, 256).toString('utf8').trimStart()
  let image = header.startsWith('<svg') || header.startsWith('<?xml')
    ? nativeImage.createFromDataURL(`data:image/svg+xml;base64,${buffer.toString('base64')}`)
    : nativeImage.createFromBuffer(buffer)
  if (image.isEmpty()) return failure('无法识别该图片格式')

  const size = image.getSize()
  const maxSide = Math.max(size.width, size.height)
  if (maxSide > 128) {
    const ratio = 128 / maxSide
    image = image.resize({
      width: Math.max(1, Math.round(size.width * ratio)),
      height: Math.max(1, Math.round(size.height * ratio)),
      quality: 'best'
    })
  }

  let output = image.toPNG()
  if (output.length > MAX_ICON_OUTPUT_BYTES) {
    const current = image.getSize()
    const ratio = 96 / Math.max(current.width, current.height)
    output = image.resize({
      width: Math.max(1, Math.round(current.width * ratio)),
      height: Math.max(1, Math.round(current.height * ratio)),
      quality: 'good'
    }).toPNG()
  }
  if (output.length > MAX_ICON_OUTPUT_BYTES) return failure('压缩后的图标仍然过大，请选择更简单的图片')
  return success(`data:image/png;base64,${output.toString('base64')}`)
}

function downloadBuffer (targetUrl, redirects = 3) {
  return new Promise((resolve, reject) => {
    const url = new URL(targetUrl)
    const client = url.protocol === 'https:' ? https : http
    const request = client.get(url, {
      headers: { 'User-Agent': 'uTools Quick Launcher/2.1' },
      timeout: 8000
    }, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location && redirects > 0) {
        response.resume()
        resolve(downloadBuffer(new URL(response.headers.location, url).toString(), redirects - 1))
        return
      }
      if (response.statusCode !== 200) {
        response.resume()
        reject(new Error(`站点图标请求失败（${response.statusCode}）`))
        return
      }
      const chunks = []
      let size = 0
      response.on('data', (chunk) => {
        size += chunk.length
        if (size > MAX_ICON_INPUT_BYTES) request.destroy(new Error('站点图标过大'))
        else chunks.push(chunk)
      })
      response.on('end', () => resolve(Buffer.concat(chunks)))
      response.on('error', reject)
    })
    request.on('timeout', () => request.destroy(new Error('站点图标请求超时')))
    request.on('error', reject)
  })
}

function success (data) {
  return data === undefined ? { ok: true } : { ok: true, data }
}

function failure (error) {
  return { ok: false, error: error instanceof Error ? error.message : String(error) }
}

window.services = {
  async openPath (targetPath) {
    try {
      if (!fs.existsSync(targetPath)) return failure('文件或文件夹不存在')
      const errorMessage = await shell.openPath(targetPath)
      return errorMessage ? failure(errorMessage) : success()
    } catch (error) {
      return failure(error)
    }
  },

  async openExternal (targetUrl) {
    try {
      const url = new URL(targetUrl)
      if (!['http:', 'https:'].includes(url.protocol)) return failure('仅支持 HTTP 或 HTTPS 网址')
      await shell.openExternal(url.toString())
      return success()
    } catch (error) {
      return failure(error)
    }
  },

  runCommand (command, options = {}) {
    if (typeof command !== 'string' || !command.trim()) return Promise.resolve(failure('命令不能为空'))
    if (command.length > 8000) return Promise.resolve(failure('命令过长'))

    const cwd = typeof options.workingDirectory === 'string' && options.workingDirectory.trim()
      ? options.workingDirectory.trim()
      : undefined
    if (cwd && (!fs.existsSync(cwd) || !fs.statSync(cwd).isDirectory())) {
      return Promise.resolve(failure('命令工作目录不存在或不是文件夹'))
    }
    const normalizedOptions = {
      workingDirectory: cwd,
      environment: commandEnvironment(options.environment)
    }
    if (options.mode === 'terminal') return runCommandInTerminal(command.trim(), normalizedOptions)

    const selectedShell = commandShell(command.trim())
    return spawnDetached(selectedShell.executable, selectedShell.args, {
      cwd,
      env: { ...process.env, ...normalizedOptions.environment }
    })
  },

  async selectFile (type = 'file') {
    return window.utools.showOpenDialog({
      properties: ['multiSelections', type === 'folder' ? 'openDirectory' : 'openFile']
    })
  },

  inspectPath (targetPath) {
    try {
      const stats = fs.statSync(targetPath)
      return { exists: true, isDirectory: stats.isDirectory() }
    } catch {
      return { exists: false, isDirectory: false }
    }
  },

  readTextFile (targetPath) {
    try {
      return success(fs.readFileSync(targetPath, 'utf8'))
    } catch (error) {
      return failure(error)
    }
  },

  writeTextFile (targetPath, content) {
    try {
      fs.writeFileSync(targetPath, content, 'utf8')
      return success()
    } catch (error) {
      return failure(error)
    }
  },

  async selectImage () {
    return window.utools.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico'] }]
    })
  },

  readFileAsBase64 (filePath) {
    try {
      const stats = fs.statSync(filePath)
      if (stats.size > MAX_ICON_INPUT_BYTES) return failure('原始图片不能超过 2 MB')
      return imageDataUrl(fs.readFileSync(filePath))
    } catch (error) {
      return failure(error)
    }
  },

  async fetchFavicon (targetUrl) {
    try {
      const normalized = /^[a-z][a-z0-9+.-]*:\/\//i.test(targetUrl) ? targetUrl : `https://${targetUrl}`
      const pageUrl = new URL(normalized)
      if (!['http:', 'https:'].includes(pageUrl.protocol)) return failure('仅支持 HTTP 或 HTTPS 网址')
      const buffer = await downloadBuffer(new URL('/favicon.ico', pageUrl).toString())
      return imageDataUrl(buffer)
    } catch (error) {
      return failure(error)
    }
  },

  getPlatform () {
    return process.platform
  }
}
