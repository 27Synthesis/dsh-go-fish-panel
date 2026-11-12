// 鱼：把大肥鱼（dsh-fish）落在盘上的东西摆进手机原生面板。
// 两个面板：观测台（只读：轮数/成长/她说过的话）+ 设置（能看能改 ~/.dsh-fish/config.json）。
// 桌面版那边在「设置 → 鱼」，手机 App 没有入口，这里补一角。
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

import { KNOBS, applyForm, current } from './cfg.js'

export const name = 'local-fish-panel'

const FISH_ROOT = () => (process.env.DSH_FISH_HOME || join(homedir(), '.dsh-fish'))

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
    turns: String(home.turns ?? 0),
    real: String(real.length),
    born: fmt(home.createdAt),
    lastAt: fmt(lastBucket ? lastBucket.at : (real[real.length - 1] || {}).ts),
    title: clip(home.title || '还没建家', 40),
    said,
    grew,
  }
}

// 面板上的分组：顺序就是显示顺序。改这里就能加减项。
// 时段两项（winStart/winEnd）不是 KNOBS 里的键，单独认。
const GROUPS = [
  { title: '作息', items: ['wakesPerDay', 'winStart', 'winEnd', 'growthDays'] },
  { title: '刷站与画面', items: ['browseEnabled', 'browsePerDay', 'browseTopN', 'browseVoices', 'videoEnabled', 'videoPerDay'] },
  { title: '说话与日记', items: ['commentEnabled', 'commentPerDay', 'commentReplyToReplies', 'diaryEnabled', 'diaryVisible'] },
  { title: '她自己', items: ['driveEnabled', 'interestEnabled', 'dreamEnabled', 'proactiveEnabled', 'proactiveMaxPerDay'] },
  { title: '会话与网', items: ['chatRotateAfter', 'chatCarry', 'memoryDocBudget', 'biliEnabled', 'notifyEnabled'] },
]

const KNOB = Object.fromEntries(KNOBS.map((k) => [k.key, k]))
const TIMES = { winStart: '醒来的开始', winEnd: '醒来的结束' }

function control(key) {
  if (TIMES[key]) return { type: 'time', label: TIMES[key], bind: 'data.f.' + key }
  const k = KNOB[key]
  if (!k) return { type: 'text', text: '（未知项 ' + key + '）' }
  if (k.kind === 'bool') return { type: 'toggle', label: k.label, bind: 'data.f.' + key }
  return { type: 'number', label: k.label, bind: 'data.f.' + key, min: k.min, max: k.max, step: k.step }
}

function settingsChildren() {
  const out = []
  for (const g of GROUPS) {
    out.push({ type: 'text', text: g.title, style: { size: 'subtitle' } })
    for (const key of g.items) out.push(control(key))
  }
  return out
}

function settingsView() {
  return {
    v: 2,
    type: 'stack',
    title: '鱼·设置',
    children: [
      { type: 'text', text: '改完点「保存设置」，她下一次醒来就按新的来。', tone: 'muted' },
      { type: 'form', submit: 'save', submitLabel: '保存设置', children: settingsChildren() },
    ],
  }
}

export function apply(ctx) {
  ctx.inject(['dshGo'], (ctx) => {
    ctx.dshGo.panel('fish', {
      view: () => ({
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
          { type: 'text', text: '最近她说的', style: { size: 'title' } },
          { type: 'list', items: { $: 'data.said' } },
          { type: 'text', text: '成长记录', style: { size: 'title' } },
          { type: 'list', items: { $: 'data.grew' } },
          {
            type: 'actions',
            items: [
              { label: '刷新', action: 'refresh', icon: 'refresh' },
              { label: '设置', action: 'toSettings', icon: 'settings', style: 'plain' },
            ],
          },
        ],
      }),
      data: (scope, emit) => {
        emit(snapshot())
        return () => {}
      },
      actions: {
        refresh: () => ({ refresh: true }),
        toSettings: () => ({ open: 'panel:fish-settings' }),
      },
    })

    ctx.dshGo.panel('fish-settings', {
      view: () => settingsView(),
      data: (scope, emit) => {
        emit({ f: current() })
        return () => {}
      },
      actions: {
        save: (scope, event) => {
          const { changed, notes } = applyForm(event)
          if (changed === 0) return { toast: clip(notes[0] || '没有改动', 40) }
          return { toast: '已保存 ' + changed + ' 项', refresh: true }
        },
      },
    })
  })
}
