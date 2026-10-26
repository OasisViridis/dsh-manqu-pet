import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { installFakeDom } from './fake-dom.mjs'

// 端到端：真 React + 假 slots，把宿主会走的那条链路完整跑一遍——
// apply(ctx) → inject('settings.section') → register(def, component) → 渲染成 HTML。
// 只差宿主自己的面板外壳，那是 DSH 的代码，不归这个仓库测。

const CLIENT = '../.dsh-plugin/client/index.mjs'

const bootHost = async (options = {}) => {
  const dom = installFakeDom(options)
  const client = await import(CLIENT)
  client.__setReactForTest(React)

  const injected = []
  const registered = []
  let injectFactoryCalls = 0
  const slots = {
    inject(name, factory) {
      injected.push(name)
      injectFactoryCalls += 1
      return factory()
    },
    register(definition, component) {
      registered.push({ definition, component })
      return () => {}
    },
  }
  const dispose = client.apply({ slots })
  await new Promise((resolve) => setTimeout(resolve, 20))
  return { dom, dispose, injected, registered, injectFactoryCalls }
}

test('真 React 端到端：apply 后设置页注册成功并能渲染成 HTML', async (t) => {
  const { dom, dispose, injected, registered, injectFactoryCalls } = await bootHost({ width: 1280, height: 800 })
  t.after(() => { dispose(); dom.uninstall() })

  assert.deepEqual(injected, ['settings.section'])
  assert.equal(injectFactoryCalls, 1, 'inject 的 factory 只跑一次')
  assert.equal(registered.length, 1)

  const { definition, component } = registered[0]
  assert.equal(definition.id, 'manqu')
  assert.equal(definition.label(), '满区 Manqu')

  const html = renderToStaticMarkup(React.createElement(component))
  assert.match(html, /data-manqu-section=""/)
  assert.match(html, /显示满区|大小|空闲散步/)
})

test('真 React 端到端：注册后宠物照常挂载，隐藏开关与设置页同源', async (t) => {
  const { dom, dispose, registered } = await bootHost({ width: 1280, height: 800 })
  t.after(() => { dispose(); dom.uninstall() })

  const host = dom.element('[data-dsh-manqu-pet]')
  assert.ok(host !== null, '宠物本体仍在')
  assert.equal(host.hasAttribute('data-hidden'), false)

  // 设置页的组件拿到的 prefs 与宠物共用一份：直接改 store，宠物立刻隐藏。
  const { updatePrefs } = await import('../.dsh-plugin/client/prefs.mjs')
  updatePrefs({ visible: false })
  assert.equal(host.hasAttribute('data-hidden'), true)
  assert.equal(dom.element('.pet-restore').style.display, 'none', '有设置页时不再摆角标按钮')

  const html = renderToStaticMarkup(React.createElement(registered[0].component))
  assert.match(html, /已隐藏/, '重新渲染的设置页反映隐藏态')
})

test('真 React 端到端：dispose 后偏好订阅断开，不再影响已卸载的宠物', async (t) => {
  const { dom, dispose } = await bootHost({ width: 1280, height: 800 })
  const { updatePrefs, readPrefs } = await import('../.dsh-plugin/client/prefs.mjs')
  const host = dom.element('[data-dsh-manqu-pet]')
  t.after(() => { dom.uninstall() })

  dispose()
  assert.equal(host.parentNode, null, 'dispose 应摘掉宠物宿主')

  updatePrefs({ visible: false })
  assert.equal(readPrefs().visible, false, 'store 本身照常工作，只是没有监听者')
})
