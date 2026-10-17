import { test } from 'node:test'
import assert from 'node:assert/strict'
import { installFakeDom } from './fake-dom.mjs'

// client 的 apply() 是唯一入口；模块级常量（DPR/reduced-motion）只在首次 import 时求值，
// 因此每个用例安装自己的假 DOM 后复用同一模块实例。
const CLIENT = '../.dsh-plugin/client/index.mjs'
const HOST_SELECTOR = '[data-dsh-manqu-pet]'

const PET_WIDTH = 150 * (192 / 208)

const boot = async (options) => {
  const dom = installFakeDom(options)
  const { apply } = await import(CLIENT)
  const dispose = apply({})
  await new Promise((resolve) => setTimeout(resolve, 20)) // 让 pet.json/spritesheet 的加载链跑完
  return { dom, dispose }
}

test('客户端启动：挂载宠物、贴底定位、建立轮询与 SSE', async (t) => {
  const { dom, dispose } = await boot({ width: 1280, height: 800 })
  t.after(() => { dispose(); dom.uninstall() })

  const host = dom.element(HOST_SELECTOR)
  assert.ok(host !== null, '宠物宿主应挂到 body')
  assert.equal(host.style.bottom, '16px')
  assert.equal(Number.parseFloat(host.style.left), 24)
  assert.equal(dom.intervals.size, 1, '应有 1 个状态轮询定时器')
  assert.ok(dom.fetchCalls.some((url) => String(url).endsWith('/manqu/state')), '应拉过情绪状态')
  assert.ok(dom.fetchCalls.some((url) => String(url).endsWith('/manqu/assets/pet.json')), '应拉过图集 manifest')
  // 贴底时状态条/右键菜单改开在宠物上方，否则会被窗口底边裁掉
  assert.equal(host.hasAttribute('data-pop-above'), true)

  dispose()
  assert.equal(host.parentNode, null, 'dispose 应移除宠物宿主')
  assert.equal(dom.intervals.size, 0, 'dispose 应清掉轮询')
})

test('桌面端（Windows 标题栏）：记住的旧坐标被钳到按钮区以下、窗口内', async (t) => {
  const { dom, dispose } = await boot({
    width: 900,
    height: 640,
    dataset: { platform: 'win32' },
    attributes: ['data-windows-titlebar'],
    cssVars: { '--dsh-windows-titlebar-height': '40px' },
    // 旧窗口（更大）里存下的坐标：y 落在标题栏里、x 超出右边界
    storage: { 'dsh-manqu-pet:x': '1200', 'dsh-manqu-pet:y': '2' },
  })
  t.after(() => { dispose(); dom.uninstall() })

  const host = dom.element(HOST_SELECTOR)
  assert.equal(host.style.top, '44px', '顶部应让开 40px 标题栏按钮区 + 4px 间距')
  assert.equal(host.style.bottom, 'auto')
  const left = Number.parseFloat(host.style.left)
  assert.ok(Math.abs(left - (900 - PET_WIDTH - 4)) < 1e-6, `x 应收进窗口右边界，实际 ${left}`)
  // 被顶到标题栏以下 → 气泡改放宠物下方
  assert.equal(host.hasAttribute('data-bubble-below'), true)
})

test('桌面端壳层变化：退出全屏后重新钳制回标题栏安全区', async (t) => {
  const { dom, dispose } = await boot({
    width: 1000,
    height: 700,
    dataset: { platform: 'win32' },
    attributes: ['data-windows-titlebar', 'data-fullscreen'],
    cssVars: { '--dsh-windows-titlebar-height': '40px' },
    storage: { 'dsh-manqu-pet:y': '24' },
  })
  t.after(() => { dispose(); dom.uninstall() })

  const host = dom.element(HOST_SELECTOR)
  assert.equal(host.style.top, '24px', '全屏时安全区只有 20px')

  dom.setDocumentAttribute('data-fullscreen', false)
  assert.equal(host.style.top, '44px', '退出全屏后应回到 40px 标题栏以下')
})

test('桌面端窗口缩小时重新钳制 y、回到可见区', async (t) => {
  const { dom, dispose } = await boot({
    width: 1200,
    height: 900,
    dataset: { platform: 'win32' },
    attributes: ['data-windows-titlebar'],
    storage: { 'dsh-manqu-pet:y': '700' },
  })
  t.after(() => { dispose(); dom.uninstall() })

  const host = dom.element(HOST_SELECTOR)
  assert.equal(host.style.top, '700px')

  dom.resize(820, 500)
  const top = Number.parseFloat(host.style.top)
  assert.ok(top <= 500 - 150 - 4, `y 应收进更矮的窗口，实际 ${top}`)
  assert.ok(top >= 40 + 4)
})

test('桌面端最小化：隐藏时停轮询，恢复时重建并补一次状态', async (t) => {
  const { dom, dispose } = await boot({ width: 1000, height: 700 })
  t.after(() => { dispose(); dom.uninstall() })

  assert.equal(dom.intervals.size, 1)
  const before = dom.fetchCalls.length

  dom.setVisibility('hidden')
  assert.equal(dom.intervals.size, 0, '隐藏时应停掉轮询')

  dom.setVisibility('visible')
  assert.equal(dom.intervals.size, 1, '恢复时应重建轮询')
  assert.ok(dom.fetchCalls.length > before, '恢复可见时应立刻补一次状态')
})
