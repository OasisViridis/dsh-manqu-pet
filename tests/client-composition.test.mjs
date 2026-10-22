import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

// DSH 的客户端 half 组合契约（@deepseek-ai/dsh-client-modules 的 locatePkgJson/nearestPackage）：
// 宿主把 Loader 行名（包名）解析成模块文件，再从该文件所在目录向上找，**第一个 name 与包名
// 相同的 package.json 就是该包的归属清单**（ownership 到此为止，不再向上）。归属清单没有
// dsh.client 时，客户端 half 被直接跳过：/plugins 路由里不会有该包的行，浏览器里什么都不会渲染。
//
// 这条规则对本仓库的含义：`.dsh-plugin/` 里不能再放一个同名 package.json，否则它会顶替根部
// 清单成为 owner，把 dsh.client / exports["./client"] 一起挡在组合之外——宠物「不显示」。
const ROOT = resolve(import.meta.dirname, '..')

/** 复刻宿主 nearestPackage：向上找第一个 name 与包名相同的 package.json。 */
function owningManifest(entryFile, packageName) {
  let dir = dirname(entryFile)
  for (;;) {
    const candidate = join(dir, 'package.json')
    if (existsSync(candidate)) {
      let name
      try { name = JSON.parse(readFileSync(candidate, 'utf8')).name } catch { /* 坏清单不参与归属 */ }
      if (name === packageName) return candidate
    }
    const parent = dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

const readManifest = () => {
  const manifestPath = join(ROOT, 'package.json')
  return { manifestPath, manifest: JSON.parse(readFileSync(manifestPath, 'utf8')) }
}

test('客户端 half 可被宿主组合：归属清单是根部清单，且声明了 dsh.client 与 ./client 导出', () => {
  const { manifestPath, manifest } = readManifest()
  const entry = resolve(ROOT, manifest.exports['.'])

  assert.equal(
    owningManifest(entry, manifest.name),
    manifestPath,
    '根部 package.json 必须是该包的归属清单；子目录里的同名清单会顶替它，让 dsh.client 永远读不到',
  )
  assert.equal(manifest.dsh?.client?.platform, 'web', '根部清单必须声明 dsh.client.platform = web，客户端 half 才会进入 __DSH_BOOT__ 图')
  assert.equal(typeof manifest.exports?.['./client'], 'string', '根部清单必须导出 ./client，宿主据此定位 client bundle')
})

test('client bundle 存在、可被宿主按 id 挂载，且与生成器输出一致', () => {
  const { manifest } = readManifest()
  const clientPath = resolve(ROOT, manifest.exports['./client'])
  assert.ok(existsSync(clientPath), `client bundle 应存在：${clientPath}`)

  const bundle = readFileSync(clientPath, 'utf8')
  // 宿主用 factory 注册表按 id 取模块；id 与包名不一致时 require/import 都会落空。
  assert.match(
    bundle.slice(0, 200),
    new RegExp(`id:\\s*["']${manifest.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`),
    `client bundle 必须以包名 ${manifest.name} 注册到 __ModuleLoader__`,
  )
  assert.match(bundle, /window\.__ModuleLoader__\.load\(/, 'client bundle 必须是 __ModuleLoader__.load 形态')
})
