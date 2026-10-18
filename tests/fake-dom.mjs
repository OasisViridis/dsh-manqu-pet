// 极简假 DOM：只为在 node:test 里把 client 的 apply() 真跑起来（不引入 jsdom）。
// 覆盖 client/index.mjs 实际用到的表面：元素树/属性/class/style、canvas 2D、Image、
// EventSource、fetch、localStorage、matchMedia、rAF、可见性事件与定时器计数。
// 不追求浏览器语义完整；新增 client API 时按需补面。

const CAMEL_TO_KEBAB = /[A-Z]/g

class FakeStyle {
  constructor() {
    this.map = new Map()
  }

  get cssText() {
    return [...this.map].map(([key, value]) => `${key}: ${value}`).join('; ')
  }

  set cssText(text) {
    this.map.clear()
    for (const part of String(text).split(';')) {
      const index = part.indexOf(':')
      if (index > 0) this.map.set(part.slice(0, index).trim(), part.slice(index + 1).trim())
    }
  }

  getPropertyValue(name) {
    return this.map.get(name) ?? ''
  }

  setProperty(name, value) {
    this.map.set(name, String(value))
  }
}

const styleProxy = (style) => new Proxy(style, {
  get(target, prop) {
    if (prop in target) return target[prop]
    return target.map.get(String(prop).replace(CAMEL_TO_KEBAB, (m) => `-${m.toLowerCase()}`))
  },
  set(target, prop, value) {
    if (prop === 'cssText' || prop in target) target[prop] = value
    else target.map.set(String(prop).replace(CAMEL_TO_KEBAB, (m) => `-${m.toLowerCase()}`), String(value))
    return true
  },
})

const matchesSelector = (element, selector) => {
  if (selector.startsWith('.')) return element.classList.contains(selector.slice(1))
  const attribute = selector.match(/^\[([^=\]]+)\]$/)
  if (attribute) return element.hasAttribute(attribute[1])
  return element.tagName === selector.toUpperCase()
}

class FakeElement {
  constructor(tagName) {
    this.tagName = String(tagName).toUpperCase()
    this.attributes = new Map()
    this.children = []
    this.parentNode = null
    this.dataset = {}
    this.listeners = new Map()
    this.style = styleProxy(new FakeStyle())
    this.className = ''
    this._text = ''
    this._html = ''
    this.classList = {
      add: (name) => { this.className = [...new Set([...this.className.split(/\s+/).filter(Boolean), name])].join(' ') },
      remove: (name) => { this.className = this.className.split(/\s+/).filter((part) => part && part !== name).join(' ') },
      contains: (name) => this.className.split(/\s+/).includes(name),
    }
  }

  get offsetWidth() {
    return Number.parseFloat(this.style.width) || 0
  }

  get offsetHeight() {
    return Number.parseFloat(this.style.height) || 0
  }

  get textContent() {
    return this._text + this.children.map((child) => child.textContent).join('')
  }

  set textContent(value) {
    this._text = String(value)
    this.children = []
    this._html = ''
  }

  get innerHTML() {
    return this._html
  }

  set innerHTML(value) {
    this._html = String(value)
    this._text = ''
    // 只为 querySelector('.class') 造出与 class 属性对应的子元素（client 用它取状态字样）。
    this.children = [...this._html.matchAll(/class="([^"]+)"/g)].map((match) => {
      const child = new FakeElement(match[1].includes('tt') ? 'div' : 'span')
      child.className = match[1]
      child.parentNode = this
      return child
    })
  }

  setAttribute(name, value = '') {
    this.attributes.set(name, String(value))
    if (name.startsWith('data-')) {
      const key = name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())
      this.dataset[key] = String(value)
    }
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null
  }

  hasAttribute(name) {
    return this.attributes.has(name)
  }

  removeAttribute(name) {
    this.attributes.delete(name)
    if (name.startsWith('data-')) {
      const key = name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())
      delete this.dataset[key]
    }
  }

  toggleAttribute(name, force) {
    const wanted = force === undefined ? !this.hasAttribute(name) : force === true
    if (wanted) this.setAttribute(name, '')
    else this.removeAttribute(name)
    return wanted
  }

  appendChild(child) {
    child.parentNode = this
    if (child.ownerWindow === undefined) child.ownerWindow = this.ownerWindow
    this.children.push(child)
    return child
  }

  append(...nodes) {
    for (const node of nodes) this.appendChild(node)
  }

  replaceChildren(...nodes) {
    this.children = []
    this.append(...nodes)
  }

  remove() {
    if (this.parentNode === null) return
    this.parentNode.children = this.parentNode.children.filter((child) => child !== this)
    this.parentNode = null
  }

  querySelector(selector) {
    for (const child of this.children) {
      if (matchesSelector(child, selector)) return child
      const nested = child.querySelector(selector)
      if (nested !== null) return nested
    }
    return null
  }

  getBoundingClientRect() {
    const width = this.offsetWidth
    const height = this.offsetHeight
    const left = Number.parseFloat(this.style.left) || 0
    const anchoredBottom = this.style.bottom !== undefined && this.style.bottom !== 'auto'
    const top = anchoredBottom
      ? (this.ownerWindow?.innerHeight ?? 0) - (Number.parseFloat(this.style.bottom) || 0) - height
      : Number.parseFloat(this.style.top) || 0
    return { left, top, width, height, right: left + width, bottom: top + height }
  }

  setPointerCapture() {}

  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set())
    this.listeners.get(type).add(listener)
  }

  removeEventListener(type, listener) {
    this.listeners.get(type)?.delete(listener)
  }

  dispatch(type, event = {}) {
    for (const listener of this.listeners.get(type) ?? []) listener({ type, ...event })
  }
}

class FakeCanvas extends FakeElement {
  constructor() {
    super('canvas')
    this.width = 0
    this.height = 0
  }

  getContext() {
    return {
      setTransform() {},
      clearRect() {},
      drawImage() {},
      // 极小的像素缓冲即可：client 的帧检测会因空图集回落到状态的默认帧数。
      getImageData: () => ({ data: new Uint8ClampedArray(4) }),
    }
  }
}

/**
 * 安装一套假 DOM 到全局。
 * @param {object} [options]
 * @param {number} [options.width] - window.innerWidth
 * @param {number} [options.height] - window.innerHeight
 * @param {Record<string,string>} [options.dataset] - documentElement.dataset（platform 等）
 * @param {string[]} [options.attributes] - documentElement 上预置的属性（data-windows-titlebar / data-fullscreen）
 * @param {Record<string,string>} [options.cssVars] - getComputedStyle 可见的自定义属性
 * @param {string} [options.visibility] - 初始 document.visibilityState（default: 'visible'）
 * @param {Record<string,string>} [options.storage] - localStorage 预置值
 */
export function installFakeDom(options = {}) {
  const {
    width = 1280,
    height = 800,
    dataset = {},
    attributes = [],
    cssVars = {},
    visibility: initialVisibility = 'visible',
    storage: seed = {},
  } = options

  const storage = new Map(Object.entries(seed))
  const windowListeners = new Map()
  const documentListeners = new Map()
  const intervals = new Set()
  let visibility = initialVisibility

  const makeElement = (tagName) => (tagName === 'canvas' ? new FakeCanvas() : new FakeElement(tagName))

  const documentElement = new FakeElement('html')
  documentElement.observers = []
  for (const [key, value] of Object.entries(dataset)) documentElement.dataset[key] = value
  for (const name of attributes) documentElement.setAttribute(name, '')
  for (const [name, value] of Object.entries(cssVars)) documentElement.style.setProperty(name, value)

  const head = new FakeElement('head')
  const body = new FakeElement('body')
  documentElement.append(head, body)

  const document = {
    documentElement,
    head,
    body,
    activeElement: null,
    get visibilityState() { return visibility },
    createElement: makeElement,
    querySelector: (selector) => {
      if (matchesSelector(documentElement, selector)) return documentElement
      const found = head.querySelector(selector) ?? body.querySelector(selector)
      return found
    },
    addEventListener(type, listener) {
      if (!documentListeners.has(type)) documentListeners.set(type, new Set())
      documentListeners.get(type).add(listener)
    },
    removeEventListener(type, listener) {
      documentListeners.get(type)?.delete(listener)
    },
  }

  const window = {
    innerWidth: width,
    innerHeight: height,
    devicePixelRatio: 2,
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    addEventListener(type, listener) {
      if (!windowListeners.has(type)) windowListeners.set(type, new Set())
      windowListeners.get(type).add(listener)
    },
    removeEventListener(type, listener) {
      windowListeners.get(type)?.delete(listener)
    },
  }

  // 页面元素需要能读到窗口尺寸（getBoundingClientRect 的贴底分支）。
  const patchOwnerWindow = (element) => {
    element.ownerWindow = window
    for (const child of element.children) patchOwnerWindow(child)
  }
  for (const element of [documentElement, head, body]) patchOwnerWindow(element)

  const images = []
  class FakeImage {
    constructor() {
      this.naturalWidth = 1536
      this.naturalHeight = 2288
      images.push(this)
    }

    set src(value) {
      this._src = value
      queueMicrotask(() => this.onload?.())
    }

    get src() {
      return this._src
    }
  }

  class FakeMutationObserver {
    constructor(callback) {
      this.callback = callback
      this.targets = []
    }

    // 记录 observe options：attributeFilter 内的标记才触发回调，避免假 DOM 放过写错的属性名。
    observe(target, options = {}) {
      target.observers = target.observers ?? []
      target.observers.push({
        callback: this.callback,
        attributes: options.attributes !== false,
        filter: Array.isArray(options.attributeFilter) ? options.attributeFilter : null,
      })
      this.targets.push(target)
    }

    disconnect() {
      for (const target of this.targets) {
        target.observers = (target.observers ?? []).filter((watcher) => watcher.callback !== this.callback)
      }
      this.targets = []
    }
  }

  const eventSources = []
  class FakeEventSource {
    constructor(url) {
      this.url = url
      this.onmessage = null
      this.closed = false
      eventSources.push(this)
    }

    close() {
      this.closed = true
    }

    /** 模拟服务端推送一条 SSE 消息（client 只看 onmessage，不看 data）。 */
    emit(payload = {}) {
      this.onmessage?.({ data: JSON.stringify(payload) })
    }
  }

  const realSetInterval = globalThis.setInterval
  const realClearInterval = globalThis.clearInterval

  const fetchCalls = []
  const fetch = async (url) => {
    fetchCalls.push(url)
    if (String(url).endsWith('/manqu/state')) {
      return {
        ok: true,
        json: async () => ({
          mood: { thinking: false, waiting: false, celebrateUntil: 0, failedUntil: 0, readyUntil: 0, titles: [] },
          activities: [],
          bubble: null,
          ts: Date.now(),
        }),
      }
    }
    return { ok: true, json: async () => ({ displayName: '满区', spritesheetPath: 'spritesheet.webp' }) }
  }

  const globals = {
    document,
    window,
    getComputedStyle: (element) => ({ getPropertyValue: (name) => element.style.getPropertyValue(name) }),
    requestAnimationFrame: () => 0,
    cancelAnimationFrame: () => {},
    setTimeout,
    clearTimeout,
    setInterval: (fn, ms) => {
      const id = realSetInterval(fn, ms)
      intervals.add(id)
      return id
    },
    clearInterval: (id) => {
      intervals.delete(id)
      realClearInterval(id)
    },
    localStorage: {
      getItem: (key) => (storage.has(key) ? storage.get(key) : null),
      setItem: (key, value) => storage.set(key, String(value)),
      removeItem: (key) => storage.delete(key),
    },
    performance: { now: () => Date.now() },
    fetch,
    Image: FakeImage,
    EventSource: FakeEventSource,
    MutationObserver: FakeMutationObserver,
    queueMicrotask,
  }

  const restore = []
  for (const [name, value] of Object.entries(globals)) {
    restore.push([name, globalThis[name]])
    globalThis[name] = value
  }

  return {
    document,
    window,
    intervals,
    fetchCalls,
    storage,
    images,
    eventSources,
    element: (selector) => document.querySelector(selector),
    /** 切换页面可见性并派发 visibilitychange（桌面端最小化/恢复）。 */
    setVisibility(next) {
      visibility = next
      for (const listener of documentListeners.get('visibilitychange') ?? []) listener({ type: 'visibilitychange' })
    },
    /** 改变窗口尺寸并派发 resize（桌面端缩放窗口）。 */
    resize(nextWidth, nextHeight) {
      window.innerWidth = nextWidth
      window.innerHeight = nextHeight
      for (const listener of windowListeners.get('resize') ?? []) listener({ type: 'resize' })
    },
    /** 写入桌面端壳层标记并按 attributeFilter 通知 MutationObserver。 */
    setDocumentAttribute(name, enabled, value = '') {
      if (enabled) documentElement.setAttribute(name, value)
      else documentElement.removeAttribute(name)
      for (const watcher of documentElement.observers ?? []) {
        if (!watcher.attributes) continue
        if (watcher.filter !== null && !watcher.filter.includes(name)) continue
        watcher.callback([{ type: 'attributes', attributeName: name, target: documentElement }])
      }
    },
    uninstall() {
      for (const id of [...intervals]) clearInterval(id)
      intervals.clear()
      for (const [name, value] of restore.reverse()) {
        if (value === undefined) delete globalThis[name]
        else globalThis[name] = value
      }
    },
  }
}
