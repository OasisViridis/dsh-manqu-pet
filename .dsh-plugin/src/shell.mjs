// 宿主窗口壳层（Web 浏览器 / DSH 桌面端）→ 宠物安全区 的纯函数。
//
// DSH 桌面端（Electron 外壳）与浏览器加载同一套 Web GUI：客户端插件、路由、__DSH_BOOT__
// 完全一致，差异只在外层窗口壳。桌面外壳的预加载脚本把壳层事实写到 <html>：
// - Windows：BrowserWindow 用 titleBarStyle:"hidden" + titleBarOverlay({height:40})，
//   预加载写 data-windows-titlebar 与 --dsh-windows-titlebar-height:40px；顶部 40px 被
//   系统最小化/最大化/关闭按钮覆盖，页面内容压在其下（ui-layout 也给这块区域
//   -webkit-app-region:drag）。
// - macOS：红绿灯按钮 + --dsh-frame-top-clearance:48px。
// - 全屏（data-fullscreen）：原生控件隐藏，安全区降为 20px（ui-layout 的
//   [data-windows-titlebar][data-fullscreen] 分支）。
// 浏览器（无任何标记）安全区为 0：标签栏在页面之外，页面顶部就是内容。
//
// 本模块只做几何计算与标记解析，不访问真实 DOM 对象（可传假 documentElement），
// 便于 node:test 单测；client 负责把结果写回宿主元素。

/** 宠物与窗口边缘的最小间距（px）。 */
export const PET_GAP = 4

/** Electron titleBarOverlay 的默认高度（px），与桌面外壳预加载写入的变量一致。 */
export const WINDOWS_TITLEBAR_HEIGHT = 40

/** macOS 红绿灯安全区高度（px），对齐 ui-layout 的 --dsh-frame-top-clearance。 */
export const MACOS_TOP_CLEARANCE = 48

/** 全屏时原生控件隐藏，仅保留可视内边距（px），对齐 ui-layout 的 [data-fullscreen] 分支。 */
export const FULLSCREEN_TOP_CLEARANCE = 20

/** 安全区不变时复用，避免每次钳位都分配对象。 */
const NO_INSETS = Object.freeze({ top: 0, right: 0, bottom: 0, left: 0 })

const finiteOr = (value, fallback) => (Number.isFinite(value) ? value : fallback)

/**
 * 从文档根节点读取宿主壳层标记（浏览器 / 桌面端）。
 * @param {object|null|undefined} root - document.documentElement 或等价假对象。
 * @param {{titlebarHeight?: number}} [hint] - 从 CSS 变量解析出的标题栏高度。
 * @returns {{platform: string, windowsTitlebar: boolean, fullscreen: boolean, titlebarHeight: number|undefined}}
 */
export function shellEnvFrom(root, hint = {}) {
  if (root === null || typeof root !== 'object') {
    return { platform: '', windowsTitlebar: false, fullscreen: false, titlebarHeight: undefined }
  }
  const dataset = root.dataset ?? {}
  const hasAttribute = typeof root.hasAttribute === 'function' ? (name) => root.hasAttribute(name) === true : () => false
  const height = Number.isFinite(hint.titlebarHeight) ? hint.titlebarHeight : undefined
  return {
    platform: typeof dataset.platform === 'string' ? dataset.platform : '',
    windowsTitlebar: hasAttribute('data-windows-titlebar'),
    fullscreen: hasAttribute('data-fullscreen'),
    titlebarHeight: height,
  }
}

/**
 * 宿主窗口壳层占用的安全区（宠物不得进入，否则会被原生控件盖住或抢走窗口拖动）。
 * @param {{platform?: string, windowsTitlebar?: boolean, fullscreen?: boolean, titlebarHeight?: number}} [env]
 * @returns {{top: number, right: number, bottom: number, left: number}}
 */
export function shellInsets(env = {}) {
  const platform = typeof env.platform === 'string' ? env.platform : ''
  const windowsTitlebar = env.windowsTitlebar === true
  if (platform !== 'darwin' && !windowsTitlebar) return NO_INSETS
  if (env.fullscreen === true) return { ...NO_INSETS, top: FULLSCREEN_TOP_CLEARANCE }
  if (windowsTitlebar) {
    const height = finiteOr(env.titlebarHeight, WINDOWS_TITLEBAR_HEIGHT)
    return { ...NO_INSETS, top: height > 0 ? height : WINDOWS_TITLEBAR_HEIGHT }
  }
  return { ...NO_INSETS, top: MACOS_TOP_CLEARANCE }
}

const clampAxis = (value, min, max) => Math.min(max, Math.max(min, value))

/**
 * 水平方向钳制：宠物不能越出窗口左右边缘。
 * @param {number} x - 期望左边距。
 * @param {number} width - 宠物宽度。
 * @param {number} viewportWidth - 窗口内宽。
 * @param {number} [gap] - 最小边缘间距。
 * @returns {number}
 */
export function clampPetX(x, width, viewportWidth, gap = PET_GAP) {
  const safeGap = Math.max(0, finiteOr(gap, PET_GAP))
  const petWidth = Math.max(0, finiteOr(width, 0))
  const vw = Math.max(0, finiteOr(viewportWidth, 0))
  const maxX = Math.max(safeGap, vw - petWidth - safeGap)
  return clampAxis(finiteOr(x, safeGap), safeGap, maxX)
}

/**
 * 把宠物左上角钳制进窗口可视区并避开宿主壳层安全区。
 * 窗口过小时以安全区下沿为准（宁可底部溢出，也不让宠物被标题栏吞掉）。
 * @param {{x?: number, y?: number, width?: number, height?: number}} rect
 * @param {{viewportWidth?: number, viewportHeight?: number}} viewport
 * @param {{top?: number, right?: number, bottom?: number, left?: number}} [insets]
 * @param {number} [gap]
 * @returns {{x: number, y: number}}
 */
export function clampPetPosition(rect = {}, viewport = {}, insets = NO_INSETS, gap = PET_GAP) {
  const safeGap = Math.max(0, finiteOr(gap, PET_GAP))
  const width = Math.max(0, finiteOr(rect.width, 0))
  const height = Math.max(0, finiteOr(rect.height, 0))
  const vw = Math.max(0, finiteOr(viewport.viewportWidth, 0))
  const vh = Math.max(0, finiteOr(viewport.viewportHeight, 0))
  const minY = Math.max(0, finiteOr(insets?.top, 0) + safeGap)
  const maxY = Math.max(minY, vh - height - safeGap)
  return {
    x: clampPetX(rect.x, width, vw, safeGap),
    y: clampAxis(finiteOr(rect.y, minY), minY, maxY),
  }
}
