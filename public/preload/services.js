const { shell } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
const { spawn } = require('node:child_process')

const MAX_ICON_BYTES = 300 * 1024

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

  runCommand (command) {
    return new Promise((resolve) => {
      if (typeof command !== 'string' || !command.trim()) {
        resolve(failure('命令不能为空'))
        return
      }
      if (command.length > 8000) {
        resolve(failure('命令过长'))
        return
      }

      let settled = false
      let startedTimer
      const selectedShell = commandShell(command.trim())
      const child = spawn(selectedShell.executable, selectedShell.args, {
        detached: true,
        stdio: 'ignore',
        windowsHide: false
      })

      child.once('spawn', () => {
        startedTimer = setTimeout(() => {
          if (settled) return
          settled = true
          child.unref()
          resolve(success({ pid: child.pid, shell: selectedShell.executable, platform: process.platform }))
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
          ? success({ pid: child.pid, shell: selectedShell.executable, platform: process.platform })
          : failure(`命令已退出，代码 ${code}`))
      })
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
      if (stats.size > MAX_ICON_BYTES) return failure('图标不能超过 300 KB')

      const extension = path.extname(filePath).toLowerCase().slice(1)
      const mimeTypes = {
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        gif: 'image/gif',
        svg: 'image/svg+xml',
        webp: 'image/webp',
        ico: 'image/x-icon'
      }
      const mimeType = mimeTypes[extension] || 'application/octet-stream'
      const data = fs.readFileSync(filePath, 'base64')
      return success(`data:${mimeType};base64,${data}`)
    } catch (error) {
      return failure(error)
    }
  },

  getPlatform () {
    return process.platform
  }
}
