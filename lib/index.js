// 鱼：把大肥鱼（dsh-fish）落在盘上的东西摆进手机原生面板。
// 一个面板，面板里面自己翻页：观测台 + 三页设置（作息 / 上网 / 说话与记忆）。
// dsh-go 把一个 panel 画成一张卡，拆成四个 panel 就是四张卡，滚起来没头；
// 而一个视图最多 32 个输入控件，五十七个开关也塞不进一页——所以走「一个面板 + 翻页」：
// 每次只渲染当前页的控件，页码存在模块里，动作返回 { refresh: true } 让它重画。
// 设置只碰 ~/.dsh-fish/config.json。
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

import { KNOBS, PAGES, applyForm, current } from './cfg.js'

export const name = 'local-fish-panel'

const FISH_ROOT = () => (process.env.DSH_FISH_HOME || join(homedir(), '.dsh-fish'))

// ---- 侧边栏开关：只动 ui.json 里 plugins.seats 的 sidebar.panellist 座位。
const DSH_HOME = () => (process.env.DSH_HOME || join(homedir(), '.dsh'))
const UI_FILE = () => join(DSH_HOME(), 'dsh-go', 'ui.json')
const SEAT_SLOT = 'sidebar.panellist'

// 文件在、却读不出来（坏 JSON / 没权限）时返回 null：宁可什么都不改，也别把用户的 ui.json 覆盖掉。
function readUI() {
  let raw
  try {
    raw = readFileSync(UI_FILE(), 'utf8')
  } catch (e) {
    return e && e.code === 'ENOENT' ? {} : null
  }
  if (!raw.trim()) return {}
  try {
    const ui = JSON.parse(raw)
    return ui && typeof ui === 'object' && !Array.isArray(ui) ? ui : null
  } catch {
    return null
  }
}

function sideHidden() {
  const ui = readUI() || {}
  const seats = (ui.plugins && ui.plugins.seats) || {}
  const slot = seats[SEAT_SLOT] || {}
  return slot[name] === 'hidden'
}

function setSideHidden(hidden) {
  const ui = readUI()
  if (!ui) throw new Error('ui.json 读不出来')
  ui.version = ui.version || 1
  const plugins = ui.plugins && typeof ui.plugins === 'object' ? ui.plugins : {}
  const seats = plugins.seats && typeof plugins.seats === 'object' ? plugins.seats : {}
  const slot = seats[SEAT_SLOT] && typeof seats[SEAT_SLOT] === 'object' ? seats[SEAT_SLOT] : {}
  // 两种情况都显式写出来：删掉这一条等于没声明座位，面板会退回它自己声明的 placement，
  // 不一定是这个侧边栏槽位，关一次再开就回不去了。
  slot[name] = hidden ? 'hidden' : 'native'
  if (Object.keys(slot).length) seats[SEAT_SLOT] = slot
  else delete seats[SEAT_SLOT]
  if (Object.keys(seats).length) plugins.seats = seats
  else delete plugins.seats
  if (Object.keys(plugins).length) ui.plugins = plugins
  else delete ui.plugins
  mkdirSync(join(DSH_HOME(), 'dsh-go'), { recursive: true })
  writeFileSync(UI_FILE(), JSON.stringify(ui, null, 2) + '\n')
}

function readJSON(file) {
  try { return JSON.parse(readFileSync(file, 'utf8')) } catch { return null }
}

function readEvents(file) {
  try {
    return readFileSync(file, 'utf8').split('\n').filter(Boolean).map((line) => {
      try { return JSON.parse(line) } catch { return null }
    }).filter(Boolean)
  } catch { return [] }
}

const pad = (n) => String(n).padStart(2, '0')
function fmt(ts) {
  if (!ts) return '—'
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return '—'
  return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes())
}

function clip(text, max) {
  const s = String(text ?? '').replace(/\s+/g, ' ').trim()
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}

// 表单回传是一层套一层的对象（value / values / f / data / fields），而且 App 提交的键是
// bind 完整路径（如 data.side），所以裸键和「.键」结尾的都认；cfg.js 的 unwrap 只认设置页
// 那些键，这里要取自己的键，所以单独写一个。
export function pickField(value, key) {
  const seen = new Set()
  const walk = (v, depth) => {
    if (!v || typeof v !== 'object' || depth > 5 || seen.has(v)) return undefined
    seen.add(v)
    if (Object.prototype.hasOwnProperty.call(v, key)) return v[key]
    for (const k of Object.keys(v)) {
      if (k.endsWith('.' + key)) return v[k]
    }
    for (const k of ['value', 'values', 'f', 'data', 'fields', 'form']) {
      const hit = walk(v[k], depth + 1)
      if (hit !== undefined) return hit
    }
    return undefined
  }
  return walk(value, 0)
}

function snapshot() {
  const root = FISH_ROOT()
  const home = readJSON(join(root, 'home.json')) || {}
  const talk = readJSON(join(root, 'talk-recent.json')) || {}
  const events = readEvents(join(root, 'events.jsonl'))

  const real = events.filter((e) => e && e.type !== 'meta')
  const said = []
  const grew = []
  for (let i = real.length - 1; i >= 0 && said.length < 5; i -= 1) {
    const e = real[i]
    const text = clip(e.text, 90)
    if (!text) continue
    if (e.type === 'utterance' || e.type === 'voice') said.push({ title: text, subtitle: fmt(e.ts) })
  }
  for (let i = real.length - 1; i >= 0 && grew.length < 8; i -= 1) {
    const e = real[i]
    const text = clip(e.text, 70)
    if (!text) continue
    grew.push({ title: text, subtitle: fmt(e.ts) + ' · ' + e.type, tone: e.type === 'heard' ? 'muted' : undefined })
  }

  const buckets = talk && talk.buckets ? talk.buckets : {}
  const homeBucket = Array.isArray(buckets.home) ? buckets.home : []
  const lastBucket = homeBucket[homeBucket.length - 1]

  return {
    // 侧边栏开关的当前值：true = 放进侧边栏。ui.json 里没这条座位就算开。
    side: !sideHidden(),
    turns: String(home.turns ?? 0),
    real: String(real.length),
    born: fmt(home.createdAt),
    lastAt: fmt(lastBucket ? lastBucket.at : (real[real.length - 1] || {}).ts),
    title: clip(home.title || '还没建家', 40),
    said,
    grew,
  }
}

// ---- 翻页：view(scope) 每次 refresh 都会重新调，所以页码记在模块里就够。
const pageByScope = new Map()
const scopeKey = (scope) => (scope && (scope.sessionId || scope.session || scope.id)) || '*'
const pageOf = (scope) => pageByScope.get(scopeKey(scope)) || process.env.FISH_PANEL_PAGE || 'home'

// ---- 一个键画一个控件：开关 / 输入框 / 数字 / 滑块；时段键拆成开始 + 结束（可带「跟作息走」）。

function timeControls(k) {
  const out = [
    { type: 'time', label: k.label + '·开始', bind: 'data.f.' + k.key + 'Start' },
    { type: 'time', label: k.label + '·结束', bind: 'data.f.' + k.key + 'End' },
  ]
  if (k.follow) out.push({ type: 'toggle', label: '不单独设，跟着作息走', bind: 'data.f.' + k.key + 'Follow' })
  return out
}

function controlOf(k) {
  if (k.kind === 'win') return timeControls(k)
  const base = { label: k.unit ? k.label + '（' + k.unit + '）' : k.label, bind: 'data.f.' + k.key }
  if (k.kind === 'bool') return [{ type: 'toggle', ...base }]
  if (k.kind === 'list') return [{ type: 'textField', ...base, placeholder: '用逗号隔开，留空就是不限' }]
  // 小范围给滑块（一拖就到底），大范围给数字框（滑块拖不准）
  const span = Number(k.max) - Number(k.min)
  if (Number.isFinite(span) && span > 0 && span <= 10 && (k.step || 1) === 1) {
    return [{ type: 'slider', ...base, min: k.min, max: k.max, step: 1 }]
  }
  return [{ type: 'number', ...base, min: k.min, max: k.max, step: k.step }]
}

function sectionsOf(pageId) {
  const groups = []
  for (const k of KNOBS) {
    if (k.panel !== pageId) continue
    let g = groups.find((x) => x.label === k.group)
    if (!g) { g = { label: k.group, children: [] }; groups.push(g) }
    for (const c of controlOf(k)) g.children.push(c)
  }
  return groups
}

// 观测台上那四个最常动的开关（完整的一套在下面三页里）。
const QUICK = [
  { key: 'biliEnabled', label: '允许她上 B 站' },
  { key: 'dreamEnabled', label: '会做梦' },
  { key: 'diaryEnabled', label: '每天写日记' },
  { key: 'proactiveEnabled', label: '可以主动找你' },
]

function homeView() {
  return {
    v: 2,
    type: 'stack',
    title: '鱼·观测台',
    children: [
      {
        type: 'row',
        children: [
          { type: 'metric', label: '轮数', value: { $: 'data.turns' } },
          { type: 'metric', label: '成长记录', value: { $: 'data.real' } },
          { type: 'metric', label: '建家', value: { $: 'data.born' } },
        ],
      },
      {
        type: 'keyValue',
        items: [
          ['现在', { $: 'data.title' }],
          ['上次说话', { $: 'data.lastAt' }],
        ],
      },
      { type: 'text', text: '常用开关', style: { size: 'title' } },
      {
        type: 'form',
        submit: 'saveQuick',
        submitLabel: '应用',
        children: [
          ...QUICK.map((q) => ({ type: 'toggle', label: q.label, bind: 'data.f.' + q.key })),
          { type: 'text', text: '全部设置（五十七项）在下面那三页里。', tone: 'muted' },
        ],
      },
      { type: 'text', text: '设置', style: { size: 'title' } },
      {
        type: 'list',
        items: PAGES.map((p) => ({
          title: p.title,
          subtitle: p.sub,
          trailing: '›',
          icon: p.icon,
          action: p.go,
        })),
      },
      { type: 'text', text: '最近她说的', style: { size: 'title' } },
      { type: 'list', items: { $: 'data.said' } },
      { type: 'text', text: '成长记录', style: { size: 'title' } },
      { type: 'list', items: { $: 'data.grew' } },
      {
        type: 'form',
        submit: 'saveSide',
        submitLabel: '应用',
        children: [
          { type: 'toggle', label: '放进侧边栏', bind: 'data.side' },
          { type: 'text', text: '关掉后鱼只留在插件详情里，侧边栏那一格空出来。改完点「应用」。', tone: 'muted' },
        ],
      },
      { type: 'actions', items: [{ label: '刷新', action: 'refresh', icon: 'refresh' }] },
    ],
  }
}

function settingsView(page) {
  const nav = PAGES.filter((p) => p.id !== page.id).map((p) => ({ label: p.label, action: p.go, icon: p.icon }))
  return {
    v: 2,
    type: 'stack',
    title: page.title,
    children: [
      { type: 'text', text: page.note, tone: 'muted' },
      {
        type: 'form',
        submit: 'save',
        submitLabel: '保存这一页',
        children: [
          ...sectionsOf(page.id).map((g) => ({ type: 'collapsible', label: g.label, expanded: true, children: g.children })),
          { type: 'text', text: '保存后她下一次醒来才按新的来；没改的键不会被写进 config.json。', tone: 'muted' },
        ],
      },
      { type: 'actions', items: [{ label: '回观测台', action: 'goHome', icon: 'heart' }, ...nav] },
    ],
  }
}

// 三页保存共用：只写真的变了的键。
function saveKnobs(scope, event) {
  const { changed, notes } = applyForm(event)
  if (changed === 0) {
    // 留个证据：万一还报「没有改动」，能看到 App 到底提交了什么形状。
    try {
      mkdirSync(FISH_ROOT(), { recursive: true })
      writeFileSync(join(FISH_ROOT(), 'panel-save-debug.json'), JSON.stringify(event, null, 2))
    } catch { /* 存不上就算了，不影响提示 */ }
    return { toast: clip(notes[0] || '没有改动', 40) }
  }
  return { toast: '已保存 ' + changed + ' 项', refresh: true }
}

export function apply(ctx) {
  ctx.inject(['dshGo'], (ctx) => {
    ctx.dshGo.panel('fish', {
      view: (scope) => {
        const page = PAGES.find((p) => p.id === pageOf(scope))
        return page ? settingsView(page) : homeView()
      },
      data: (scope, emit) => {
        emit({ ...snapshot(), f: current() })
        return () => {}
      },
      actions: {
        refresh: () => ({ refresh: true }),
        goHome: (scope) => { pageByScope.set(scopeKey(scope), 'home'); return { refresh: true } },
        goRhythm: (scope) => { pageByScope.set(scopeKey(scope), 'rhythm'); return { refresh: true } },
        goNet: (scope) => { pageByScope.set(scopeKey(scope), 'net'); return { refresh: true } },
        goTalk: (scope) => { pageByScope.set(scopeKey(scope), 'talk'); return { refresh: true } },
        save: saveKnobs,
        saveQuick: saveKnobs,
        saveSide: (scope, event) => {
          const v = pickField(event, 'side')
          // 表单没带这个字段（比如只点了刷新）就当作没动，别顺手把侧边栏关掉。
          if (v === undefined) return { toast: '没改动' }
          if (readUI() === null) return { toast: '改不了 ui.json：读不出来' }
          const on = v === true || v === 'true' || v === 1 || v === '1'
          if (on === !sideHidden()) return { toast: '没改动' }
          try {
            setSideHidden(!on)
            return { toast: on ? '已放回侧边栏' : '已从侧边栏收起', refresh: true }
          } catch (e) {
            return { toast: '改不了 ui.json：' + clip(e && e.message, 40) }
          }
        },
      },
    })
  })
}

