import { readFile, readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const root = process.cwd()
const dist = path.join(root, 'dist')
const requiredFiles = ['index.html', 'plugin.json', 'logo.png', 'logo.svg', 'preload/services.js', 'LICENSE']

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function collectFiles(directory, prefix = '') {
  const files = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = path.join(prefix, entry.name)
    if (entry.isDirectory()) files.push(...await collectFiles(path.join(directory, entry.name), relative))
    else files.push(relative)
  }
  return files
}

for (const file of requiredFiles) {
  const details = await stat(path.join(dist, file)).catch(() => null)
  assert(details?.isFile(), `发布产物缺少 ${file}`)
}

const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
const pluginJson = JSON.parse(await readFile(path.join(dist, 'plugin.json'), 'utf8'))
assert(pluginJson.version === packageJson.version, 'package.json 与 plugin.json 版本不一致')
assert(pluginJson.name === 'zqbyq8zn', '插件标识发生变化，会导致历史数据无法延续')
assert(pluginJson.logo === 'logo.png', '插件主图标必须继续使用 PNG 发布资源')

const logo = await readFile(path.join(dist, 'logo.png'))
assert(logo.subarray(1, 4).toString() === 'PNG', 'logo.png 不是有效 PNG')
assert(logo.readUInt32BE(16) >= 256 && logo.readUInt32BE(20) >= 256, 'logo.png 尺寸不得小于 256×256')

const files = await collectFiles(dist)
assert(!files.some((file) => file.endsWith('.map')), '发布产物不应包含 source map')
const sizes = await Promise.all(files.map(async (file) => (await stat(path.join(dist, file))).size))
const totalBytes = sizes.reduce((total, size) => total + size, 0)
assert(totalBytes < 5 * 1024 * 1024, '发布产物超过 5 MB，请检查是否误打包源文件')

console.info(`发布检查通过：v${pluginJson.version}，${files.length} 个文件，${(totalBytes / 1024).toFixed(1)} KB`)
