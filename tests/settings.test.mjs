import { test } from 'node:test'
import assert from 'node:assert/strict'
import { installFakeDom } from './fake-dom.mjs'
import {
  SIZE_DEFAULT, SIZE_MAX, SIZE_MIN, clampSize, readPrefs, readPosition, resetPosition,
  subscribePrefs, updatePrefs,
} from '../.dsh-plugin/client/prefs.mjs'

const CLIENT = '../.dsh-plugin/client/index.mjs'

/**
 * 假 React：只覆盖设置页用到的 API。
 * createElement 遇到函数组件直接调用，这样断言能拿到展开后的真实元素树；
 * useState 只给初值（首帧渲染够用），useEffect 不执行（订阅链路单独用 store 测）。
 */
const makeReact = () => ({
  createElement(type, props, ...children) {
    const merged = { ...(props ?? {}), children }
    return typeof type === 'function' ? type(merged) : { type, props: merged }
  },
  useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
  useEffect: () => {},
})

/** 把元素树里的可见文字拼起来，用来断言文案确实渲染了。 */
const collectText = (node) => {
  if (node === null || node === undefined || node === false) return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(collectText).join('')
  return collectText(node.props?.children)
}

/** 按 tag / 谓词找第一个节点。 */
const find = (node, predicate) => {
  if (node === null || node === undefined || typeof node !== 'object') return null
  if (Array.isArray(node)) {
    for (const child of node) {
      const hit = find(child, predicate)
      if (hit !== null) return hit
    }
    return null
  }
  if (node.type !== undefined && predicate(node)) return node
  return find(node.props?.children, predicate)
}

const findAll = (node, predicate, out = []) => {
  if (node === null || node === undefined || typeof node !== 'object') return out
  if (Array.isArray(node)) {
    for (const child of node) findAll(child, predicate, out)
    return out
  }
  if (node.type !== undefined && predicate(node)) out.push(node)
  findAll(node.props?.children, predicate, out)
  return out
}

/** 装一套假 DOM + 假 slots，把 client 真跑起来。 */
const boot = async (options = {}, { withReact = true } = {}) => {
  const dom = installFakeDom(options)
  const client = await import(CLIENT)
  client.__setReactForTest(withReact ? makeReact() : null)

  const injected = []
  const registered = []
  const slots = {
    inject(name, factory) { injected.push(name); factory() },
    register(definition, component) {
      registered.push({ definition, component })
      return () => {}
    },
  }
  const dispose = client.apply({ slots })
  await new Promise((resolve) => setTimeout(resolve, 20))
  return { dom, dispose, injected, registered }
}

// ── 偏好 store：纯函数与持久化 ──────────────────────────────────────────────

test('clampSize：越界与非法值都被压回合法区间', () => {
  assert.equal(clampSize(150), 150)
  assert.equal(clampSize(SIZE_MIN - 50), SIZE_MIN)
  assert.equal(clampSize(SIZE_MAX + 50), SIZE_MAX)
  assert.equal(clampSize('180'), 180)
  assert.equal(clampSize('abc'), SIZE_DEFAULT)
  assert.equal(clampSize(Number.NaN), SIZE_DEFAULT)
  assert.equal(clampSize(180.7), 181, '尺寸取整，避免亚像素模糊')
})

test('readPrefs：旧版 hidden 键语义反转，缺省视为显示中', () => {
  const dom = installFakeDom({ storage: { 'dsh-manqu-pet:hidden': 'true' } })
  try {
    const prefs = readPrefs()
    assert.equal(prefs.visible, false, '旧键存的是「隐藏」，读出来要反过来')
    assert.equal(prefs.size, SIZE_DEFAULT)
    assert.equal(prefs.wander, true)
    assert.equal(prefs.look, true)
  } finally { dom.uninstall() }
})

test('updatePrefs：写入即持久化，并广播给所有订阅者', () => {
  const dom = installFakeDom()
  const seen = []
  const unsubscribe = subscribePrefs((event) => seen.push(event))
  try {
    updatePrefs({ visible: false, size: 210, wander: false })
    assert.equal(readPrefs().visible, false)
    assert.equal(readPrefs().size, 210)
    assert.equal(readPrefs().wander, false)
    assert.equal(seen.length, 1)
    assert.equal(seen[0].prefs.size, 210)
    assert.equal(dom.storage.get('dsh-manqu-pet:hidden'), 'true', '隐藏写回旧键，老版本也能读到')
    assert.equal(dom.storage.get('dsh-manqu-pet:size'), '210')
  } finally {
    unsubscribe()
    dom.uninstall()
  }
})

test('resetPosition：坐标归位并单独广播 resetPosition 标记', () => {
  const dom = installFakeDom({ storage: { 'dsh-manqu-pet:x': '640', 'dsh-manqu-pet:y': '300' } })
  const seen = []
  const unsubscribe = subscribePrefs((event) => seen.push(event))
  try {
    resetPosition()
    assert.deepEqual(readPosition(), { x: 24, y: null })
    assert.equal(seen.length, 1)
    assert.equal(seen[0].resetPosition, true, '宠物靠这个标记重新钳制，而不是自己猜')
  } finally {
    unsubscribe()
    dom.uninstall()
  }
})

// ── settings.section 注册契约 ───────────────────────────────────────────────

test('有 slots 时注册 settings.section：id/order/label 齐全', async (t) => {
  const { dom, dispose, injected, registered } = await boot({ width: 1280, height: 800 })
  t.after(() => { dispose(); dom.uninstall() })

  assert.deepEqual(injected, ['settings.section'], '声明注入设置分区槽位')
  assert.equal(registered.length, 1)
  const { definition } = registered[0]
  assert.equal(definition.name, 'settings.section')
  assert.equal(definition.id, 'manqu')
  assert.equal(typeof definition.order, 'number')
  assert.equal(definition.label(), '满区 Manqu', 'label 是 thunk，语言切换时由宿主重新求值')
})

test('设置页渲染：标题、显示开关、尺寸滑杆、小动作开关都在', async (t) => {
  const { dom, dispose, registered } = await boot({ width: 1280, height: 800 })
  t.after(() => { dispose(); dom.uninstall() })

  const tree = registered[0].component()
  const text = collectText(tree)
  assert.match(text, /满区 Manqu/)
  assert.match(text, /显示满区/)
  assert.match(text, /回到默认位置/)
  assert.match(text, /空闲散步/)
  assert.match(text, /视线跟随/)
  assert.match(text, /绿冻永远是灰泽满的第二选择/)

  const switches = findAll(tree, (node) => node.props?.role === 'switch')
  assert.equal(switches.length, 3, '显示/散步/视线三个开关')
  for (const item of switches) {
    assert.equal(item.props['aria-checked'], true, '默认全开')
    assert.equal(typeof item.props['aria-label'], 'string')
  }

  const range = find(tree, (node) => node.props?.type === 'range')
  assert.ok(range !== null, '尺寸是滑杆')
  assert.equal(range.props.min, SIZE_MIN)
  assert.equal(range.props.max, SIZE_MAX)
  assert.equal(range.props.value, SIZE_DEFAULT)
})

test('设置页的尺寸滑杆写进 store 后，宠物当场缩放', async (t) => {
  const { dom, dispose, registered } = await boot({ width: 1280, height: 800 })
  t.after(() => { dispose(); dom.uninstall() })

  const tree = registered[0].component()
  const range = find(tree, (node) => node.props?.type === 'range')
  range.props.onChange({ target: { value: '210' } })

  const host = dom.element('[data-dsh-manqu-pet]')
  assert.equal(host.style.height, '210px')
  assert.equal(readPrefs().size, 210)
})

test('设置页关闭显示后，宠物隐藏且不再摆右下角恢复按钮', async (t) => {
  const { dom, dispose, registered } = await boot({ width: 1280, height: 800 })
  t.after(() => { dispose(); dom.uninstall() })

  const tree = registered[0].component()
  const toggle = findAll(tree, (node) => node.props?.role === 'switch')[0]
  toggle.props.onClick(false)

  const host = dom.element('[data-dsh-manqu-pet]')
  assert.equal(host.hasAttribute('data-hidden'), true)
  assert.equal(dom.element('.pet-restore').style.display, 'none', '有设置页时那个角标按钮不该再冒出来')
})

test('没有 React 时不注册设置页，隐藏后仍由右下角按钮兜底', async (t) => {
  const { dom, dispose, injected, registered } = await boot({ width: 1280, height: 800 }, { withReact: false })
  t.after(() => { dispose(); dom.uninstall() })

  assert.deepEqual(injected, [], '拿不到 React 就不碰 slots')
  assert.equal(registered.length, 0)

  updatePrefs({ visible: false })
  assert.equal(dom.element('[data-dsh-manqu-pet]').hasAttribute('data-hidden'), true)
  assert.equal(dom.element('.pet-restore').style.display, '', '老宿主靠这个出口把宠物叫回来')
})

test('启动时是隐藏态：有设置页就不摆角标按钮', async (t) => {
  const { dom, dispose } = await boot({ width: 1280, height: 800, storage: { 'dsh-manqu-pet:hidden': 'true' } })
  t.after(() => { dispose(); dom.uninstall() })

  assert.equal(dom.element('[data-dsh-manqu-pet]').hasAttribute('data-hidden'), true)
  assert.equal(dom.element('.pet-restore').style.display, 'none')
})

test('关掉散步与视线后，对应开关立刻失效', async (t) => {
  const { dom, dispose } = await boot({ width: 1280, height: 800 })
  t.after(() => { dispose(); dom.uninstall() })

  updatePrefs({ wander: false, look: false })
  assert.equal(readPrefs().wander, false)
  assert.equal(readPrefs().look, false)
  // 行为开关不改变宠物可见性——只影响后续动作调度
  assert.equal(dom.element('[data-dsh-manqu-pet]').hasAttribute('data-hidden'), false)
})
