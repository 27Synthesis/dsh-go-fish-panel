// 鱼的配置读写：只碰 config.json。保留未知键，数值夹紧，时段自校验。
// 默认值只用于面板显示——真正的默认值在 dsh-fish 的 lib/settings.js 里，
// 那边读配置时会按它自己的 DEFAULTS 补全，所以我们只写用户真的改过的键。
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

export const ROOT = () => process.env.DSH_FISH_HOME || join(homedir(), '.dsh-fish')
const FILE = () => join(ROOT(), 'config.json')

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/

/** 只用于面板显示与兜底。 */
export const DEFAULTS = {
  growthDays: 30,
  wakesPerDay: 1,
  window: ['20:00', '23:00'],
  diary: { enabled: true, visible: false },
  browse: { enabled: true, perDay: 1, topN: 4, voices: true },
  bili: { enabled: true },
  video: { enabled: true, perDay: 2 },
  comment: { enabled: false, perDay: 1, replyToReplies: true },
  drive: { enabled: true },
  interest: { enabled: true },
  dream: { enabled: true },
  proactive: { enabled: false, maxPerDay: 2 },
  chat: { rotateAfter: 40, carry: 4 },
  memory: { docBudget: 2400 },
  notify: { enabled: false },
}

/**
 * 面板上的每一项：key 是表单里的扁平名，path 是 config.json 里的点分路径。
 * 顺序就是面板上的顺序。
 */
export const KNOBS = [
  { key: 'wakesPerDay', path: 'wakesPerDay', kind: 'num', label: '每天醒几次', min: 0, max: 4, step: 1 },
  { key: 'growthDays', path: 'growthDays', kind: 'num', label: '成长周期（天）', min: 7, max: 180, step: 1 },

  { key: 'diaryEnabled', path: 'diary.enabled', kind: 'bool', label: '她每天写日记' },
  { key: 'diaryVisible', path: 'diary.visible', kind: 'bool', label: '日记给你看' },

  { key: 'browseEnabled', path: 'browse.enabled', kind: 'bool', label: '自己逛 B 站' },
  { key: 'browsePerDay', path: 'browse.perDay', kind: 'num', label: '每天逛几次', min: 0, max: 4, step: 1 },
  { key: 'browseTopN', path: 'browse.topN', kind: 'num', label: '一次看几条', min: 1, max: 20, step: 1 },
  { key: 'browseVoices', path: 'browse.voices', kind: 'bool', label: '读评论区里别人的话' },

  { key: 'videoEnabled', path: 'video.enabled', kind: 'bool', label: '能看视频画面' },
  { key: 'videoPerDay', path: 'video.perDay', kind: 'num', label: '每天看几条画面', min: 0, max: 6, step: 1 },

  { key: 'commentEnabled', path: 'comment.enabled', kind: 'bool', label: '允许她发评论' },
  { key: 'commentPerDay', path: 'comment.perDay', kind: 'num', label: '每天最多发几条', min: 0, max: 5, step: 1 },
  { key: 'commentReplyToReplies', path: 'comment.replyToReplies', kind: 'bool', label: '有人回她就回一句' },

  { key: 'driveEnabled', path: 'drive.enabled', kind: 'bool', label: '主动性（攒够了会自己醒）' },
  { key: 'interestEnabled', path: 'interest.enabled', kind: 'bool', label: '兴趣（摆到桌上的那几行）' },
  { key: 'dreamEnabled', path: 'dream.enabled', kind: 'bool', label: '会做梦' },

  { key: 'proactiveEnabled', path: 'proactive.enabled', kind: 'bool', label: '会主动找你说话' },
  { key: 'proactiveMaxPerDay', path: 'proactive.maxPerDay', kind: 'num', label: '一天最多主动开几次', min: 0, max: 12, step: 1 },

  { key: 'chatRotateAfter', path: 'chat.rotateAfter', kind: 'num', label: '聊满几轮换新会话', min: 0, max: 500, step: 1 },
  { key: 'chatCarry', path: 'chat.carry', kind: 'num', label: '换会话时带几轮原话', min: 0, max: 20, step: 1 },
  { key: 'memoryDocBudget', path: 'memory.docBudget', kind: 'num', label: '身份文档字数预算', min: 600, max: 4000, step: 100 },

  { key: 'biliEnabled', path: 'bili.enabled', kind: 'bool', label: '彻底断网（关掉她上不了 B 站）' },
  { key: 'notifyEnabled', path: 'notify.enabled', kind: 'bool', label: '桌面提醒（一天最多一次）' },
]

export function getDotted(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj)
}

function setDotted(obj, path, val) {
  const parts = path.split('.')
  const last = parts.pop()
  let cur = obj
  for (const p of parts) {
    if (typeof cur[p] !== 'object' || cur[p] === null || Array.isArray(cur[p])) cur[p] = {}
    cur = cur[p]
  }
  cur[last] = val
}

/** 读原始配置（坏了当空对象；不覆盖、不静默改盘）。 */
export function readRaw() {
  try {
    const raw = JSON.parse(readFileSync(FILE(), 'utf8'))
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  } catch {
    return {}
  }
}

/** 面板显示用的当前值。 */
export function current() {
  const raw = readRaw()
  const out = {}
  for (const k of KNOBS) {
    const val = getDotted(raw, k.path)
    out[k.key] = val === undefined || val === null ? getDotted(DEFAULTS, k.path) : val
  }
  const w = Array.isArray(raw.window) && raw.window.length === 2 ? raw.window : DEFAULTS.window
  out.winStart = String(w[0])
  out.winEnd = String(w[1])
  return out
}

/** 表单值可能被包成 {value:{…}} / {f:{…}} / {value:{f:{…}}}，都拆开。 */
export function unwrap(value) {
  const seen = new Set()
  const walk = (v, depth) => {
    if (v === null || typeof v !== 'object' || Array.isArray(v) || depth > 4 || seen.has(v)) return undefined
    seen.add(v)
    if (Object.keys(v).some((k) => k === 'wakesPerDay' || k === 'winStart' || k === 'diaryEnabled')) return v
    for (const k of ['value', 'f', 'data', 'fields']) {
      const found = walk(v[k], depth + 1)
      if (found !== undefined) return found
    }
    return undefined
  }
  const found = walk(value, 0)
  return found ?? (value && typeof value === 'object' && !Array.isArray(value) ? value : {})
}

function writeRaw(cfg) {
  const file = FILE()
  mkdirSync(dirname(file), { recursive: true })
  const tmp = file + '.tmp'
  writeFileSync(tmp, JSON.stringify(cfg, null, 2), { mode: 0o600 })
  renameSync(tmp, file)
}

/**
 * 把面板提交的值并回 config.json。
 * 只写真的变了的键；数值按面板范围夹紧；时段两个都合法且不同才写。
 */
export function applyForm(value) {
  const v = unwrap(value)
  const raw = readRaw()
  let changed = 0
  const notes = []

  for (const k of KNOBS) {
    if (!(k.key in v)) continue
    const val = v[k.key]
    if (k.kind === 'bool') {
      if (typeof val !== 'boolean') continue
      if (getDotted(raw, k.path) === val) continue
      setDotted(raw, k.path, val)
      changed += 1
    } else {
      const n = Number(val)
      if (!Number.isFinite(n)) {
        notes.push(k.label + '不是数字')
        continue
      }
      const next = Math.max(k.min, Math.min(k.max, Math.round(n)))
      if (getDotted(raw, k.path) === next) continue
      setDotted(raw, k.path, next)
      changed += 1
    }
  }

  if ('winStart' in v || 'winEnd' in v) {
    const cur = Array.isArray(raw.window) && raw.window.length === 2 ? raw.window : DEFAULTS.window
    const a = TIME_RE.test(String(v.winStart ?? '')) ? String(v.winStart) : String(cur[0])
    const b = TIME_RE.test(String(v.winEnd ?? '')) ? String(v.winEnd) : String(cur[1])
    if (a === b) notes.push('起止时间不能一样')
    else if (a !== cur[0] || b !== cur[1]) {
      raw.window = [a, b]
      changed += 1
    }
  }

  if (changed > 0) writeRaw(raw)
  return { changed, notes }
}
