// 满区偏好存储：宠物本体与设置页共享的唯一事实源。
//
// 三条约束决定了这里的形状：
// 1. 宠物（纯 DOM 渲染）与设置页（React 组件）在同一个页面里，跨模块通信只能靠模块单例；
// 2. 偏好必须活过刷新（localStorage），但 localStorage 不可用时不能让插件崩掉——退化成内存态；
// 3. 旧版本把「隐藏」存成 `dsh-manqu-pet:hidden`，键名不能换，否则老用户的隐藏状态会诈尸。

/** 宠物显示高度（px）的上下限。低于 110 看不清帧动画，高于 260 在小窗口里挡路。 */
export const SIZE_MIN = 110
export const SIZE_MAX = 260
export const SIZE_DEFAULT = 150

/** 存储键。`hidden` 是历史键：存的是「隐藏」而不是「显示」，语义反转见 readPrefs。 */
export const PREF_KEYS = Object.freeze({
  hidden: 'dsh-manqu-pet:hidden',
  size: 'dsh-manqu-pet:size',
  wander: 'dsh-manqu-pet:wander',
  look: 'dsh-manqu-pet:look',
})

const STORE = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key)
      return raw === null ? fallback : JSON.parse(raw)
    } catch { return fallback }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* 存储不可用时仅本次有效 */ }
  },
}

/** 把任意输入压成合法尺寸；非数字/NaN 回落到默认，避免一个坏值把宠物撑成 0px。 */
export const clampSize = (value) => {
  const n = typeof value === 'number' ? value : Number.parseFloat(value)
  if (!Number.isFinite(n)) return SIZE_DEFAULT
  return Math.min(SIZE_MAX, Math.max(SIZE_MIN, Math.round(n)))
}

/** 布尔偏好的读法：缺省为 true，只有显式 false 才算关。 */
const readFlag = (key) => STORE.get(key, true) !== false

/** 当前偏好的只读快照。每次调用都重新读存储，设置页与宠物永远看到同一份。 */
export function readPrefs() {
  return {
    visible: STORE.get(PREF_KEYS.hidden, false) !== true,
    size: clampSize(STORE.get(PREF_KEYS.size, SIZE_DEFAULT)),
    wander: readFlag(PREF_KEYS.wander),
    look: readFlag(PREF_KEYS.look),
  }
}

let snapshot = readPrefs()
const listeners = new Set()

const emit = (detail = {}) => {
  snapshot = readPrefs()
  for (const listener of [...listeners]) {
    try { listener({ prefs: snapshot, ...detail }) }
    catch (error) { console.warn('[dsh-manqu-pet] 偏好监听器抛错：', error) }
  }
}

/**
 * 写入一组偏好并广播。
 * @param {{visible?: boolean, size?: number, wander?: boolean, look?: boolean}} patch
 * @returns {typeof snapshot} 写完之后的新快照
 */
export function updatePrefs(patch = {}) {
  if (typeof patch.visible === 'boolean') STORE.set(PREF_KEYS.hidden, !patch.visible)
  if (patch.size !== undefined) STORE.set(PREF_KEYS.size, clampSize(patch.size))
  if (typeof patch.wander === 'boolean') STORE.set(PREF_KEYS.wander, patch.wander)
  if (typeof patch.look === 'boolean') STORE.set(PREF_KEYS.look, patch.look)
  emit()
  return snapshot
}

/**
 * 把宠物送回默认落点（贴底、靠左）。
 * 与坐标相关的两个键归宠物所有，这里只负责清掉并广播，由宠物自己重新钳制进可视区。
 */
export function resetPosition() {
  writePosition(24, null)
  emit({ resetPosition: true })
  return snapshot
}

/** 坐标不属于偏好，但和偏好共用同一个存储；宠物启动与拖拽落地都走这两个口子。 */
export function readPosition() {
  return {
    x: STORE.get('dsh-manqu-pet:x', 24),
    y: STORE.get('dsh-manqu-pet:y', null),
  }
}

export function writePosition(x, y) {
  STORE.set('dsh-manqu-pet:x', x)
  STORE.set('dsh-manqu-pet:y', y)
}

/** 订阅偏好变化；返回退订函数。 */
export function subscribePrefs(listener) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/** 最近一次广播的快照（设置页首帧渲染用，避免读存储读两遍）。 */
export const currentPrefs = () => snapshot
