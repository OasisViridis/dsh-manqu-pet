import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { installFakeDom } from './fake-dom.mjs'

// 生成物级验证：不 import 源文件，而是按宿主的真实加载方式跑 .dsh-plugin/client.js——
// 全局 __ModuleLoader__.load 收 factory，factory 拿 require 取 react，返回 exports。
// 源文件测试全绿但 bundle 包装错（exports 丢字段、react 被内联、id 不对）时，只有这里会红。

const ROOT = resolve(import.meta.dirname, '..')
const BUNDLE_PATH = join(ROOT, '.dsh-plugin', 'client.js')

/** 按宿主 ModuleLoader 的契约执行 bundle，返回 { id, exports }。 */
const loadBundle = (dom) => {
  let captured = null
  dom.window.__ModuleLoader__ = { load(definition) { captured = definition } }

  const code = readFileSync(BUNDLE_PATH, 'utf8')
  // 直接求值：bundle 是自包含的 `window.__ModuleLoader__.load({...})` 表达式。
  new Function(code)()

  assert.ok(captured !== null, 'bundle 必须调用 window.__ModuleLoader__.load')
  const provided = []
  const exports = captured.factory((id) => {
    provided.push(id)
    if (id === 'react') return React
    throw new Error(`unexpected require("${id}")：bundle 只允许宿主注入 react`)
  })
  return { id: captured.id, exports, provided }
}

test('bundle 包装：id 是包名，exports 暴露 apply/inject/name', async (t) => {
  const dom = installFakeDom({ width: 1280, height: 800 })
  t.after(() => { dom.uninstall(); delete dom.window.__ModuleLoader__ })

  const { id, exports, provided } = loadBundle(dom)
  assert.equal(id, 'dsh-manqu-pet')
  assert.equal(exports.name, 'dsh-manqu-pet')
  assert.deepEqual(exports.inject, ['slots'], '声明 slots 依赖，宿主才会注入 ctx.slots')
  assert.equal(typeof exports.apply, 'function')
  assert.deepEqual(provided, ['react'], 'react 走宿主 require，不能被打进 bundle')
})

test('bundle 运行：apply 在真 React 下注册设置页并渲染出内容', async (t) => {
  const dom = installFakeDom({ width: 1280, height: 800 })
  const { exports } = loadBundle(dom)
  const registered = []
  const dispose = exports.apply({
    slots: {
      inject(name, factory) { return factory() },
      register(definition, component) { registered.push({ definition, component }); return () => {} },
    },
  })
  t.after(() => { dispose(); dom.uninstall(); delete dom.window.__ModuleLoader__ })
  await new Promise((resolve) => setTimeout(resolve, 20))

  assert.equal(registered.length, 1)
  const html = renderToStaticMarkup(React.createElement(registered[0].component))
  assert.match(html, /data-manqu-section=""/)
  assert.match(html, /满区 Manqu/)
  assert.match(html, /dsh-manqu-pet:\*/, '版本与存储说明来自构建注入，不是假的 dev')
  assert.match(html, /v\d+\.\d+\.\d+/, '设置页显示真实包版本')
})
