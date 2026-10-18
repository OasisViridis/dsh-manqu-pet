import { test } from 'node:test'
import assert from 'node:assert/strict'
import { installFakeDom } from './fake-dom.mjs'
import { PET_GAP, WINDOWS_TITLEBAR_HEIGHT, MACOS_TOP_CLEARANCE, FULLSCREEN_TOP_CLEARANCE } from '../.dsh-plugin/src/shell.mjs'

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
  assert.equal(host.style.top, `${WINDOWS_TITLEBAR_HEIGHT + PET_GAP}px`, '顶部应让开标题栏按钮区 + 间距')
  assert.equal(host.style.bottom, 'auto')
  const left = Number.parseFloat(host.style.left)
  assert.ok(Math.abs(left - (900 - PET_WIDTH - PET_GAP)) < 1e-6, `x 应收进窗口右边界，实际 ${left}`)
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
  assert.equal(host.style.top, `${FULLSCREEN_TOP_CLEARANCE + PET_GAP}px`, '全屏时安全区只有 20px')

  dom.setDocumentAttribute('data-fullscreen', false)
  assert.equal(host.style.top, `${WINDOWS_TITLEBAR_HEIGHT + PET_GAP}px`, '退出全屏后应回到标题栏以下')
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
  assert.ok(top <= 500 - 150 - PET_GAP, `y 应收进更矮的窗口，实际 ${top}`)
  assert.ok(top >= WINDOWS_TITLEBAR_HEIGHT + PET_GAP)
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

const tick = (ms = 10) => new Promise((resolve) => setTimeout(resolve, ms))

test('桌面端（macOS）：顶部安全区读 root 发布的 --dsh-frame-top-clearance', async (t) => {
  const { dom, dispose } = await boot({
    width: 900,
    height: 640,
    dataset: { platform: 'darwin' },
    cssVars: { '--dsh-frame-top-clearance': '52px' },
    storage: { 'dsh-manqu-pet:y': '0' },
  })
  t.after(() => { dispose(); dom.uninstall() })

  const host = dom.element(HOST_SELECTOR)
  assert.equal(host.style.top, `${52 + PET_GAP}px`, '安全区应取 CSS 变量的 52px + 间距，而不是写死 48')
})

test('桌面端壳层标记后到：data-windows-titlebar / data-platform 变化都重新钳制', async (t) => {
  const { dom, dispose } = await boot({
    width: 900,
    height: 640,
    cssVars: { '--dsh-windows-titlebar-height': '40px' },
    storage: { 'dsh-manqu-pet:y': '0' },
  })
  t.after(() => { dispose(); dom.uninstall() })

  const host = dom.element(HOST_SELECTOR)
  assert.equal(host.style.top, `${PET_GAP}px`, '浏览器没有壳层安全区')

  dom.setDocumentAttribute('data-windows-titlebar', true)
  assert.equal(host.style.top, `${WINDOWS_TITLEBAR_HEIGHT + PET_GAP}px`, '标题栏标记后到时要重新钳制')

  dom.setDocumentAttribute('data-windows-titlebar', false)
  dom.setDocumentAttribute('data-platform', true, 'darwin')
  assert.equal(host.style.top, `${MACOS_TOP_CLEARANCE + PET_GAP}px`, 'data-platform 变化也要重钳，macOS 回落 48px 安全区')
})

test('窗口隐藏时 SSE 推送不触发刷新', async (t) => {
  const { dom, dispose } = await boot({ width: 1000, height: 700 })
  t.after(() => { dispose(); dom.uninstall() })

  const source = dom.eventSources[0]
  assert.ok(source !== undefined, '应建立 EventSource')

  const before = dom.fetchCalls.length
  source.emit({ ts: 1 })
  await tick()
  assert.ok(dom.fetchCalls.length > before, '可见时收到推送应刷新')

  dom.setVisibility('hidden')
  await tick()
  const hiddenCount = dom.fetchCalls.length
  source.emit({ ts: 2 })
  await tick()
  assert.equal(dom.fetchCalls.length, hiddenCount, '隐藏时 SSE 推送不应触发刷新')
})

test('启动时窗口已隐藏：先不轮询，恢复可见后开始', async (t) => {
  const { dom, dispose } = await boot({ width: 1000, height: 700, visibility: 'hidden' })
  t.after(() => { dispose(); dom.uninstall() })

  assert.equal(dom.intervals.size, 0, '隐藏启动不应建立轮询')
  assert.equal(
    dom.fetchCalls.some((url) => String(url).endsWith('/manqu/state')),
    false,
    '隐藏启动连初始状态都不拉，等恢复可见再补',
  )
  dom.setVisibility('visible')
  assert.equal(dom.intervals.size, 1, '恢复可见后开始轮询')
  assert.ok(dom.fetchCalls.some((url) => String(url).endsWith('/manqu/state')), '恢复可见后补一次状态')
})

test('隐藏时窗口缩放不改记住的坐标，恢复时重新钳制', async (t) => {
  const { dom, dispose } = await boot({
    width: 1200,
    height: 900,
    dataset: { platform: 'win32' },
    attributes: ['data-windows-titlebar'],
    cssVars: { '--dsh-windows-titlebar-height': '40px' },
    storage: { 'dsh-manqu-pet:y': '700', 'dsh-manqu-pet:hidden': 'true' },
  })
  t.after(() => { dispose(); dom.uninstall() })

  const host = dom.element(HOST_SELECTOR)
  assert.equal(host.hasAttribute('data-hidden'), true)
  assert.equal(host.style.top, '700px')

  dom.resize(800, 500)
  assert.equal(host.style.top, '700px', '隐藏时 display:none 的 0 尺寸不能覆盖记住的坐标')

  dom.element('.pet-restore').dispatch('click')
  const top = Number.parseFloat(host.style.top)
  assert.ok(top <= 500 - 150 - PET_GAP && top >= WINDOWS_TITLEBAR_HEIGHT + PET_GAP, `恢复后应重新钳制进可视区，实际 ${top}`)
})
