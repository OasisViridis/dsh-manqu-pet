import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { installFakeDom } from './fake-dom.mjs'
import { createSettingsSection } from '../.dsh-plugin/client/settings-section.mjs'

// 这一组用**真 React** 渲染设置页：假 React 能证明树长什么样，但证明不了 hooks 用法合法、
// 属性名拼错、或者 renderToStaticMarkup 会不会炸。宿主给的就是真 React，这里必须真跑一遍。

/** 渲染一次设置页，返回 HTML 与注入到 head 的样式文本。 */
const renderSection = (storage = {}) => {
  const dom = installFakeDom({ storage })
  try {
    const Section = createSettingsSection(React)
    const html = renderToStaticMarkup(React.createElement(Section))
    const styles = dom.document.head.children.map((node) => node.textContent).join('\n')
    return { html, styles }
  } finally {
    dom.uninstall()
  }
}

test('真 React 渲染：默认态输出完整分区，且样式确实注入 head', () => {
  const { html, styles } = renderSection({})

  assert.match(html, /data-manqu-section=""/, '根节点带设置页锚点')
  assert.match(html, /满区 Manqu/)
  assert.match(html, /一只住在 DSH 里的 CodexPet/)
  assert.match(html, /正在显示/)
  assert.match(html, /显示满区/)
  assert.match(html, /回到默认位置/)
  assert.match(html, /空闲散步/)
  assert.match(html, /视线跟随/)
  assert.match(html, /绿冻永远是灰泽满的第二选择/)
  assert.match(html, /role="switch"/)
  assert.match(html, /aria-checked="true"/)
  assert.match(html, /type="range"/)
  assert.ok(styles.includes('data-manqu-section'), '样式表应挂到 head')
  assert.ok(styles.includes('--dsw-alias-label-primary'), '配色走宿主主题变量，不写死')
})

test('真 React 渲染：隐藏态下开关为 off、状态徽标换成已隐藏', () => {
  const { html } = renderSection({ 'dsh-manqu-pet:hidden': 'true' })

  assert.match(html, /已隐藏/)
  assert.equal(html.includes('正在显示'), false)
  // 三处 aria-checked：显示开关为 false，散步/视线仍为 true
  assert.match(html, /aria-checked="false"/)
})

test('真 React 渲染：尺寸偏好反映到滑杆与数值', () => {
  const { html } = renderSection({ 'dsh-manqu-pet:size': '220' })

  assert.match(html, /value="220"/)
  assert.match(html, /220px/)
})
