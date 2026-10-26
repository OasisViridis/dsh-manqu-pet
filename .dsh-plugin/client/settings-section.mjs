// 满区设置页：DSH 设置面板里的一个 `settings.section`（和其他插件同一个菜单位）。
//
// 为什么要这块：隐藏宠物原来靠右键菜单，恢复靠屏幕右下角一个独立小按钮——两处都偏离
// 「DSH 插件」的常规形态。现在显示/大小/小动作都收进设置页，隐藏后随时能叫回来。
//
// 依赖边界：React 由宿主 ModuleLoader 的 require 注入（bundle 为 cjs 时保留为 require
// 调用）；拿不到 React 时整个设置页不注册，宠物退回旧的右下角恢复按钮。
import { SIZE_MAX, SIZE_MIN, readPrefs, resetPosition, subscribePrefs, updatePrefs } from './prefs.mjs'

/** 设置面板左侧导航里的这一项。id 同时是 DOM 锚点（用于测试与样式作用域）。 */
export const SECTION_ID = 'manqu'
/** 排在官方分区之后、和第三方插件同段；数字越小越靠上。 */
export const SECTION_ORDER = 92
/** 中文名，英文环境也保留「满区」——这是名字，不是术语。 */
export const SECTION_LABEL = '满区 Manqu'

const VERSION = typeof __MANQU_VERSION__ === 'undefined' ? 'dev' : __MANQU_VERSION__
/** 源文件直跑（预览/测试）时没有构建注入的版本号，别把它显示成 "vdev"。 */
const VERSION_LABEL = VERSION === 'dev' ? '开发版' : `v${VERSION}`

const CSS = `
[data-manqu-section] { display: flex; flex-direction: column; gap: 16px; padding: 4px 2px 28px;
  font-family: system-ui, sans-serif; color: var(--dsw-alias-label-primary, #e8ebf2); }
[data-manqu-section] * { box-sizing: border-box; }
[data-manqu-section] .manqu-hero { display: flex; align-items: flex-start; gap: 14px; flex-wrap: wrap;
  padding: 18px 20px; border-radius: 16px; border: 1px solid var(--dsw-alias-border-l2, rgba(255,255,255,.1));
  background: linear-gradient(140deg, color-mix(in srgb, var(--dsw-alias-state-business-primary, #5b8cff) 12%, transparent), transparent 62%),
    var(--dsw-alias-bg-layer-2, rgba(255,255,255,.03)); }
[data-manqu-section] .manqu-hero-text { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
[data-manqu-section] .manqu-hero h2 { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: 0; line-height: 1.25; }
[data-manqu-section] .manqu-hero p { margin: 0; font-size: 12.5px; line-height: 1.6;
  color: var(--dsw-alias-label-secondary, #9aa3b2); max-width: 62ch; }
[data-manqu-section] .manqu-state { margin-left: auto; display: inline-flex; align-items: center; gap: 6px;
  padding: 4px 10px; border-radius: 999px; font-size: 11.5px; white-space: nowrap;
  border: 1px solid var(--dsw-alias-border-l2, rgba(255,255,255,.12));
  color: var(--dsw-alias-label-secondary, #9aa3b2); }
[data-manqu-section] .manqu-state .dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; flex: none; }
[data-manqu-section] .manqu-state.on { color: var(--dsw-alias-state-success-primary, #4ec98c);
  border-color: color-mix(in srgb, var(--dsw-alias-state-success-primary, #4ec98c) 42%, transparent); }

[data-manqu-section] .manqu-card { display: flex; flex-direction: column; gap: 2px; padding: 6px 18px;
  border-radius: 14px; border: 1px solid var(--dsw-alias-border-l2, rgba(255,255,255,.1));
  background: var(--dsw-alias-bg-layer-2, rgba(255,255,255,.03)); }
[data-manqu-section] .manqu-card > h3 { margin: 12px 0 2px; font-size: 11px; font-weight: 620;
  letter-spacing: .08em; text-transform: uppercase; color: var(--dsw-alias-label-tertiary, #7c8496); }

[data-manqu-section] .manqu-row { display: flex; align-items: center; gap: 14px; padding: 12px 0;
  border-top: 1px solid color-mix(in srgb, var(--dsw-alias-border-l2, rgba(255,255,255,.1)) 60%, transparent); }
[data-manqu-section] .manqu-card > h3 + .manqu-row { border-top: 0; }
[data-manqu-section] .manqu-row-text { display: flex; flex-direction: column; gap: 3px; min-width: 0; flex: 1; }
[data-manqu-section] .manqu-row-text b { font-size: 13px; font-weight: 560; }
[data-manqu-section] .manqu-row-text span { font-size: 11.5px; line-height: 1.5;
  color: var(--dsw-alias-label-tertiary, #7c8496); }

[data-manqu-section] .manqu-switch { flex: none; width: 40px; height: 23px; padding: 0; border-radius: 999px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(255,255,255,.16)); cursor: pointer;
  background: var(--dsw-alias-bg-layer-3, rgba(255,255,255,.08)); position: relative;
  transition: background .16s ease-out, border-color .16s ease-out; }
[data-manqu-section] .manqu-switch::after { content: ""; position: absolute; top: 2px; left: 2px; width: 17px; height: 17px;
  border-radius: 50%; background: var(--dsw-alias-label-tertiary, #7c8496);
  transition: transform .18s cubic-bezier(.34,1.3,.4,1), background .16s ease-out; }
[data-manqu-section] .manqu-switch.on { background: color-mix(in srgb, var(--dsw-alias-state-business-primary, #5b8cff) 84%, transparent);
  border-color: transparent; }
[data-manqu-section] .manqu-switch.on::after { transform: translateX(17px); background: var(--dsw-alias-label-on-accent, #fff); }
[data-manqu-section] .manqu-switch:focus-visible { outline: 2px solid var(--dsw-alias-state-business-primary, #5b8cff); outline-offset: 2px; }

[data-manqu-section] .manqu-range { display: flex; align-items: center; gap: 12px; flex: none; }
[data-manqu-section] .manqu-range input[type="range"] { width: 168px; accent-color: var(--dsw-alias-state-business-primary, #5b8cff); }
[data-manqu-section] .manqu-range output { min-width: 46px; text-align: right; font-size: 12px;
  font-variant-numeric: tabular-nums; color: var(--dsw-alias-label-secondary, #9aa3b2); }

[data-manqu-section] .manqu-btn { flex: none; padding: 6px 13px; border-radius: 9px; font-size: 12px; cursor: pointer;
  color: var(--dsw-alias-label-primary, #e8ebf2); font-family: inherit;
  border: 1px solid var(--dsw-alias-border-l2, rgba(255,255,255,.14));
  background: var(--dsw-alias-bg-layer-3, rgba(255,255,255,.06)); }
[data-manqu-section] .manqu-btn:hover { border-color: color-mix(in srgb, var(--dsw-alias-state-business-primary, #5b8cff) 48%, transparent); }
[data-manqu-section] .manqu-btn:focus-visible { outline: 2px solid var(--dsw-alias-state-business-primary, #5b8cff); outline-offset: 2px; }

[data-manqu-section] .manqu-foot { display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  padding: 0 4px; font-size: 11.5px; color: var(--dsw-alias-label-tertiary, #7c8496); }
[data-manqu-section] .manqu-foot code { font-size: 11px; padding: 2px 6px; border-radius: 6px;
  background: var(--dsw-alias-bg-layer-3, rgba(255,255,255,.06)); color: var(--dsw-alias-label-secondary, #9aa3b2); }
[data-manqu-section] .manqu-foot .sep { opacity: .5; }
[data-manqu-section] .manqu-motto { margin-left: auto; font-style: italic; opacity: .72; }
`

/** 样式只注入一次：设置页会被反复挂载/卸载，重复插入 <style> 只会堆积。 */
const ensureCss = (doc) => {
  const id = 'dsh-manqu-pet-settings-css'
  const existing = typeof doc.getElementById === 'function'
    ? doc.getElementById(id)
    : doc.querySelector(`#${id}`)
  if (existing != null) return
  const style = doc.createElement('style')
  style.id = id
  style.textContent = CSS
  doc.head.appendChild(style)
}

/**
 * 造出设置页组件。
 * @param {object} React - 宿主提供的 React（含 createElement/useState/useEffect）
 * @returns {(props: object) => object} settings.section 的渲染函数
 */
export function createSettingsSection(React) {
  const h = React.createElement
  const { useState, useEffect } = React

  /** 一行「标题 + 说明 + 右侧控件」。控件由调用方给，行本身不猜语义。 */
  const Row = ({ title, hint, control }) => h('div', { className: 'manqu-row' },
    h('div', { className: 'manqu-row-text' }, h('b', null, title), h('span', null, hint)),
    control,
  )

  const Switch = ({ on, onChange, label }) => h('button', {
    type: 'button',
    role: 'switch',
    'aria-checked': on === true,
    'aria-label': label,
    className: `manqu-switch${on ? ' on' : ''}`,
    onClick: () => onChange(!on),
  })

  const SettingsSection = () => {
    const [prefs, setPrefs] = useState(() => readPrefs())

    // 订阅共享 store：宠物那边（右键菜单隐藏）改动时，这一页立刻跟上，不会被 localStorage 的快照骗住。
    useEffect(() => subscribePrefs(({ prefs: next }) => setPrefs(next)), [])

    ensureCss(document)

    return h('div', { 'data-manqu-section': '', 'data-section-id': SECTION_ID },
      h('header', { className: 'manqu-hero' },
        h('div', { className: 'manqu-hero-text' },
          h('h2', null, '满区 Manqu'),
          h('p', null, '一只住在 DSH 里的 CodexPet。永远 16 岁的风纪委员，话不多、嘴硬，会跟着你一起干活。'),
        ),
        h('span', { className: `manqu-state${prefs.visible ? ' on' : ''}` },
          h('span', { className: 'dot' }),
          prefs.visible ? '正在显示' : '已隐藏',
        ),
      ),

      h('section', { className: 'manqu-card' },
        h('h3', null, '显示'),
        h(Row, {
          title: '显示满区',
          hint: '关掉就从窗口左下角消失。要叫回来在这里开——不用再去翻屏幕角落找按钮。',
          control: h(Switch, { on: prefs.visible, label: '显示满区', onChange: (next) => updatePrefs({ visible: next }) }),
        }),
        h(Row, {
          title: '回到默认位置',
          hint: '拖丢了、被别的窗口压住，就按这个让它贴回左下角。',
          control: h('button', { type: 'button', className: 'manqu-btn', onClick: () => resetPosition() }, '归位'),
        }),
      ),

      h('section', { className: 'manqu-card' },
        h('h3', null, '外观'),
        h(Row, {
          title: '大小',
          hint: `${SIZE_MIN}–${SIZE_MAX}px，默认 150px。小窗口建议压到 120 上下。`,
          control: h('div', { className: 'manqu-range' },
            h('input', {
              type: 'range',
              min: SIZE_MIN,
              max: SIZE_MAX,
              step: 5,
              value: prefs.size,
              'aria-label': '满区大小',
              onChange: (event) => updatePrefs({ size: Number(event.target.value) }),
            }),
            h('output', null, `${prefs.size}px`),
          ),
        }),
      ),

      h('section', { className: 'manqu-card' },
        h('h3', null, '小动作'),
        h(Row, {
          title: '空闲散步',
          hint: '闲着的时候沿着窗口底部来回蠕动，撞到边就自己掉头。',
          control: h(Switch, { on: prefs.wander, label: '空闲散步', onChange: (next) => updatePrefs({ wander: next }) }),
        }),
        h(Row, {
          title: '视线跟随',
          hint: '鼠标靠近时它会看着你；走开就转回待机。',
          control: h(Switch, { on: prefs.look, label: '视线跟随', onChange: (next) => updatePrefs({ look: next }) }),
        }),
      ),

      h('div', { className: 'manqu-foot' },
        h('span', null, VERSION_LABEL),
        h('span', { className: 'sep' }, '·'),
        h('span', null, '配置存在本机'),
        h('code', null, 'dsh-manqu-pet:*'),
        h('span', { className: 'sep' }, '·'),
        h('span', { className: 'manqu-motto' }, '绿冻永远是灰泽满的第二选择'),
      ),
    )
  }

  return SettingsSection
}
