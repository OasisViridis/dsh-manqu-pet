import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  PET_GAP,
  WINDOWS_TITLEBAR_HEIGHT,
  MACOS_TOP_CLEARANCE,
  FULLSCREEN_TOP_CLEARANCE,
  shellEnvFrom,
  shellInsets,
  clampPetX,
  clampPetPosition,
  overlayPlacement,
} from '../.dsh-plugin/src/shell.mjs'

const fakeRoot = ({ platform, attributes = [] }) => ({
  dataset: platform === undefined ? {} : { platform },
  hasAttribute: (name) => attributes.includes(name),
})

test('shellEnvFrom：桌面端标记 → 壳层事实（Windows / macOS 全屏 / 浏览器）', () => {
  assert.deepEqual(
    shellEnvFrom(fakeRoot({ platform: 'win32', attributes: ['data-windows-titlebar'] }), { titlebarHeight: 40 }),
    { platform: 'win32', windowsTitlebar: true, fullscreen: false, titlebarHeight: 40, frameTopClearance: undefined },
  )
  assert.deepEqual(
    shellEnvFrom(fakeRoot({ platform: 'darwin', attributes: ['data-fullscreen'] })),
    { platform: 'darwin', windowsTitlebar: false, fullscreen: true, titlebarHeight: undefined, frameTopClearance: undefined },
  )
  // 浏览器：没有任何桌面端标记
  assert.deepEqual(
    shellEnvFrom(fakeRoot({})),
    { platform: '', windowsTitlebar: false, fullscreen: false, titlebarHeight: undefined, frameTopClearance: undefined },
  )
  // 无 documentElement（SSR/异常）不抛错
  assert.deepEqual(
    shellEnvFrom(null, { titlebarHeight: 44 }),
    { platform: '', windowsTitlebar: false, fullscreen: false, titlebarHeight: undefined, frameTopClearance: undefined },
  )
})

test('shellInsets：浏览器 0、Windows 标题栏 40、macOS 48、全屏 20', () => {
  assert.equal(shellInsets(shellEnvFrom(fakeRoot({}))).top, 0)
  assert.equal(shellInsets(shellEnvFrom(fakeRoot({ platform: 'win32', attributes: ['data-windows-titlebar'] }))).top, WINDOWS_TITLEBAR_HEIGHT)
  assert.equal(shellInsets(shellEnvFrom(fakeRoot({ platform: 'darwin' }))).top, MACOS_TOP_CLEARANCE)
  // 全屏收回原生控件安全区
  assert.equal(
    shellInsets(shellEnvFrom(fakeRoot({ platform: 'win32', attributes: ['data-windows-titlebar', 'data-fullscreen'] }))).top,
    FULLSCREEN_TOP_CLEARANCE,
  )
  assert.equal(
    shellInsets(shellEnvFrom(fakeRoot({ platform: 'darwin', attributes: ['data-fullscreen'] }))).top,
    FULLSCREEN_TOP_CLEARANCE,
  )
  // 其余方向不占用（桌面端窗口没有底部/侧边原生 chrome）
  const insets = shellInsets(shellEnvFrom(fakeRoot({ platform: 'win32', attributes: ['data-windows-titlebar'] })))
  assert.deepEqual({ right: insets.right, bottom: insets.bottom, left: insets.left }, { right: 0, bottom: 0, left: 0 })
})

test('shellInsets：CSS 变量给出的标题栏高度优先，非法值回落 40', () => {
  const withHeight = (titlebarHeight) => shellInsets({ windowsTitlebar: true, titlebarHeight }).top
  assert.equal(withHeight(44), 44)
  assert.equal(withHeight(0), WINDOWS_TITLEBAR_HEIGHT)
  assert.equal(withHeight(-8), WINDOWS_TITLEBAR_HEIGHT)
  assert.equal(withHeight(Number.NaN), WINDOWS_TITLEBAR_HEIGHT)
  assert.equal(withHeight(undefined), WINDOWS_TITLEBAR_HEIGHT)
})

test('clampPetX：贴边留出 PET_GAP，窗口更窄时压回左边界', () => {
  assert.equal(clampPetX(700, 120, 800), 800 - 120 - PET_GAP)
  assert.equal(clampPetX(-30, 120, 800), PET_GAP)
  assert.equal(clampPetX(200, 120, 800), 200)
  // 窗口比宠物还窄：退化为左边缘间距
  assert.equal(clampPetX(500, 120, 100), PET_GAP)
  assert.equal(clampPetX(Number.NaN, 120, 800), PET_GAP)
})

test('clampPetPosition：Windows 标题栏下沿以下、窗口内，且保留 x 钳制', () => {
  const insets = shellInsets({ windowsTitlebar: true, titlebarHeight: 40 })
  const viewport = { viewportWidth: 1000, viewportHeight: 700 }
  // 想把宠物拖到标题栏里 → 压回 40 + gap
  assert.deepEqual(clampPetPosition({ x: 100, y: 2, width: 139, height: 150 }, viewport, insets), { x: 100, y: 40 + PET_GAP })
  // 底部越界 → 压在窗口内
  const bottom = clampPetPosition({ x: 100, y: 900, width: 139, height: 150 }, viewport, insets)
  assert.equal(bottom.y, 700 - 150 - PET_GAP)
  // 右侧越界同时钳制 x
  const right = clampPetPosition({ x: 990, y: 300, width: 139, height: 150 }, viewport, insets)
  assert.equal(right.x, 1000 - 139 - PET_GAP)
  assert.equal(right.y, 300)
})

test('clampPetPosition：换到更小的桌面端窗口后，记住的旧坐标会被拉回可视区', () => {
  const insets = shellInsets({ windowsTitlebar: true, titlebarHeight: 40 })
  // 旧窗口 1440×900 存的 y=720；桌面端窗口 900×640
  const restored = clampPetPosition({ x: 1200, y: 720, width: 139, height: 150 }, { viewportWidth: 900, viewportHeight: 640 }, insets)
  assert.ok(restored.x <= 900 - 139 - PET_GAP)
  assert.ok(restored.y >= 40 + PET_GAP)
  assert.ok(restored.y <= 640 - 150 - PET_GAP)
})

test('clampPetPosition：窗口过小时固定在安全区下沿，不被标题栏吞掉', () => {
  const insets = shellInsets({ platform: 'darwin' })
  const tiny = clampPetPosition({ x: 0, y: 0, width: 139, height: 150 }, { viewportWidth: 320, viewportHeight: 120 }, insets)
  assert.equal(tiny.y, MACOS_TOP_CLEARANCE + PET_GAP)
  assert.equal(tiny.x, PET_GAP)
  // 无安全区时同样不产生负坐标
  const web = clampPetPosition({ x: -10, y: -10, width: 139, height: 150 }, { viewportWidth: 320, viewportHeight: 120 })
  assert.deepEqual(web, { x: PET_GAP, y: PET_GAP })
})

test('shellInsets：macOS 优先用 root 发布的 --dsh-frame-top-clearance，非法值回落 48', () => {
  const withClearance = (frameTopClearance) => shellInsets({ platform: 'darwin', frameTopClearance }).top
  assert.equal(withClearance(52), 52)
  assert.equal(withClearance(0), MACOS_TOP_CLEARANCE)
  assert.equal(withClearance(-1), MACOS_TOP_CLEARANCE)
  assert.equal(withClearance(Number.NaN), MACOS_TOP_CLEARANCE)
  assert.equal(withClearance(undefined), MACOS_TOP_CLEARANCE)
})

test('overlayPlacement：贴底或窗口较矮时菜单开上方，贴顶时气泡放下方', () => {
  // 贴底：下方只有 16px 间距 → 菜单/状态条改开在上方，上方空间够 → 气泡照旧在上方
  assert.deepEqual(
    overlayPlacement({ top: 800 - 16 - 150, height: 150, viewportHeight: 800 }),
    { popAbove: true, bubbleBelow: false },
  )
  // 贴顶：上方不够放气泡 → 气泡改放下方；下方空间大 → 菜单照旧在下方
  assert.deepEqual(
    overlayPlacement({ top: 44, height: 150, viewportHeight: 800 }),
    { popAbove: false, bubbleBelow: true },
  )
  // 居中：两侧都够 → 保持默认（下方菜单、上方气泡）
  assert.deepEqual(
    overlayPlacement({ top: 300, height: 150, viewportHeight: 800 }),
    { popAbove: false, bubbleBelow: false },
  )
  // 窗口过矮且宠物偏上：上方空间比下方多才改开在上方，避免两头都塞不下
  assert.deepEqual(
    overlayPlacement({ top: 200, height: 150, viewportHeight: 400 }),
    { popAbove: true, bubbleBelow: false },
  )
  // 非法输入不产生 NaN
  assert.deepEqual(overlayPlacement({}), { popAbove: false, bubbleBelow: true })
})
