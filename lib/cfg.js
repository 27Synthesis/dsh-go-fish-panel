// 鱼的配置读写：只碰 config.json。保留未知键，数值夹紧，时段自校验。
// 默认值只用于面板显示——真正的默认值在 dsh-fish 的 lib/settings.js 里（那边的 DEFAULTS
// 和 LIMITS 才是准的），那边读配置时会按自己的 DEFAULTS 补全，所以我们只写用户真的改过的键。
// 这里抄一份是为了：面板一打开就能显示「现在是什么」，而不是空着。
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

export const ROOT = () => process.env.DSH_FISH_HOME || join(homedir(), '.dsh-fish')
const FILE = () => join(ROOT(), 'config.json')

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/

/** 只用于面板显示与兜底。与桌面 settings.js 的 DEFAULTS 对齐。 */
export const DEFAULTS = {
  growthDays: 30,
  wakesPerDay: 1,
  window: ['20:00', '23:00'],
  absenceAfterDays: 2,
  daily: { events: 2, questions: 1 },
  diary: { enabled: true, visible: false, keepDays: 0 },
  browse: { enabled: true, perDay: 1, topN: 4, deepRead: 6, danmaku: 6, voices: true, window: null },
  bili: { enabled: true, minIntervalMs: 800, jitterMs: 500 },
  video: { enabled: true, perDay: 2, frames: 9 },
  avoid: { keywords: ['恐怖', '血腥', '鬼畜', '政治'], upMids: [], minDuration: 60 },
  comment: {
    enabled: false, perDay: 1, replyPerDay: 2, replyToReplies: true,
    scanEveryMin: 30, window: ['20:00', '23:00'], atOwner: true,
  },
  proactive: {
    enabled: false, maxPerDay: 2, minIdleHours: 6, cooldownHours: 4,
    sendTools: [], foldSilent: true, idleCountsSeen: false,
  },
  notify: { enabled: false },
  chat: { rotateAfter: 40, carry: 4, replyChars: 0 },
  rooms: { groupRotateDays: 7 },
  memory: {
    docBudget: 2400, sleepEveryDays: 7, selfWake: true, sleepKeep: 12,
    beliefsShown: 3, hearEvery: 3, echo: true,
  },
  drive: { enabled: true },
  interest: { enabled: true },
  dream: { enabled: true },
  rules: { offers: true, holdDays: 3, cooldownDays: 3 },
}

/**
 * 面板上的每一项。字段：
 *   key   表单里的扁平名（= data.f.<key> 的绑定名）
 *   path  config.json 里的点分路径
 *   kind  num | bool | text | list | win
 *   label 面板上的字；unit 只影响显示
 * win 类：自动多出 <key>Start / <key>End 两个时间输入；带 follow 的再多一个 <key>Follow 开关
 *         （follow = true 时写 null，表示「跟作息一样」）。
 * list 类：逗号分隔的一行字，存成字符串数组。
 * panel/group 决定它出现在哪一页、哪一段。
 */
export const KNOBS = [
  // ---------------- 鱼·作息 ----------------
  { panel: 'rhythm', group: '成长', key: 'growthDays', path: 'growthDays', kind: 'num', label: '成长周期', unit: '天', min: 7, max: 180, step: 1 },
  { panel: 'rhythm', group: '成长', key: 'absenceAfterDays', path: 'absenceAfterDays', kind: 'num', label: '冷落多少天才算疏远', unit: '天', min: 1, max: 30, step: 1 },
  { panel: 'rhythm', group: '成长', key: 'wakesPerDay', path: 'wakesPerDay', kind: 'num', label: '每天醒几次', unit: '次', min: 0, max: 4, step: 1 },
  { panel: 'rhythm', group: '成长', key: 'window', path: 'window', kind: 'win', label: '每天几点醒' },
  { panel: 'rhythm', group: '成长', key: 'dailyEvents', path: 'daily.events', kind: 'num', label: '每天最多推几条成长事件', unit: '条', min: 0, max: 6, step: 1 },
  { panel: 'rhythm', group: '成长', key: 'dailyQuestions', path: 'daily.questions', kind: 'num', label: '其中「她问你」最多几条', unit: '条', min: 0, max: 6, step: 1 },
  { panel: 'rhythm', group: '成长', key: 'chatReplyChars', path: 'chat.replyChars', kind: 'num', label: '她一轮最多写多少字（0 = 不限）', unit: '字', min: 0, max: 2000, step: 50 },

  { panel: 'rhythm', group: '日记', key: 'diaryEnabled', path: 'diary.enabled', kind: 'bool', label: '她每天写日记' },
  { panel: 'rhythm', group: '日记', key: 'diaryVisible', path: 'diary.visible', kind: 'bool', label: '日记给你看' },
  { panel: 'rhythm', group: '日记', key: 'diaryKeepDays', path: 'diary.keepDays', kind: 'num', label: '日记留多久（0 = 永久）', unit: '天', min: 0, max: 3650, step: 30 },

  { panel: 'rhythm', group: '她自己的事', key: 'sleepEveryDays', path: 'memory.sleepEveryDays', kind: 'num', label: '多久让她回头想一次（0 = 不主动想）', unit: '天', min: 0, max: 60, step: 1 },
  { panel: 'rhythm', group: '她自己的事', key: 'sleepKeep', path: 'memory.sleepKeep', kind: 'num', label: '总共留几条自述', unit: '条', min: 0, max: 100, step: 1 },
  { panel: 'rhythm', group: '她自己的事', key: 'selfWake', path: 'memory.selfWake', kind: 'bool', label: '空醒时自己找点事做' },
  { panel: 'rhythm', group: '她自己的事', key: 'echo', path: 'memory.echo', kind: 'bool', label: '身份段末尾摆一句她最近说的' },
  { panel: 'rhythm', group: '她自己的事', key: 'driveEnabled', path: 'drive.enabled', kind: 'bool', label: '主动性（攒够了会自己醒）' },
  { panel: 'rhythm', group: '她自己的事', key: 'interestEnabled', path: 'interest.enabled', kind: 'bool', label: '兴趣（摆到桌上的那几行）' },
  { panel: 'rhythm', group: '她自己的事', key: 'dreamEnabled', path: 'dream.enabled', kind: 'bool', label: '会做梦' },

  // ---------------- 鱼·上网 ----------------
  { panel: 'net', group: '能不能上网', key: 'biliEnabled', path: 'bili.enabled', kind: 'bool', label: '允许她上网（B 站）' },
  { panel: 'net', group: '能不能上网', key: 'browseEnabled', path: 'browse.enabled', kind: 'bool', label: '按时间自动替她逛一圈' },
  { panel: 'net', group: '能不能上网', key: 'browseWindow', path: 'browse.window', kind: 'win', follow: true, label: '上网时间段' },

  { panel: 'net', group: '逛多少', key: 'browsePerDay', path: 'browse.perDay', kind: 'num', label: '每天最多刷几次（0 = 不刷）', unit: '次', min: 0, max: 4, step: 1 },
  { panel: 'net', group: '逛多少', key: 'browseTopN', path: 'browse.topN', kind: 'num', label: '每次翻几条', unit: '条', min: 1, max: 20, step: 1 },
  { panel: 'net', group: '逛多少', key: 'browseDeepRead', path: 'browse.deepRead', kind: 'num', label: '每条读几条热评', unit: '条', min: 0, max: 20, step: 1 },
  { panel: 'net', group: '逛多少', key: 'browseDanmaku', path: 'browse.danmaku', kind: 'num', label: '每条抽几条弹幕（0 = 不抽）', unit: '条', min: 0, max: 30, step: 1 },
  { panel: 'net', group: '逛多少', key: 'browseVoices', path: 'browse.voices', kind: 'bool', label: '记下评论区的一句话' },

  { panel: 'net', group: '看画面', key: 'videoEnabled', path: 'video.enabled', kind: 'bool', label: '允许看视频画面' },
  { panel: 'net', group: '看画面', key: 'videoPerDay', path: 'video.perDay', kind: 'num', label: '每天看几条画面（0 = 不看）', unit: '条', min: 0, max: 6, step: 1 },
  { panel: 'net', group: '看画面', key: 'videoFrames', path: 'video.frames', kind: 'num', label: '每条取几帧', unit: '帧', min: 4, max: 16, step: 1 },

  { panel: 'net', group: '不想看的', key: 'avoidKeywords', path: 'avoid.keywords', kind: 'list', label: '屏蔽关键词（逗号隔开）' },
  { panel: 'net', group: '不想看的', key: 'avoidUpMids', path: 'avoid.upMids', kind: 'list', label: 'up 主黑名单（mid，逗号隔开）' },
  { panel: 'net', group: '不想看的', key: 'avoidMinDuration', path: 'avoid.minDuration', kind: 'num', label: '太短的不看', unit: '秒', min: 0, max: 3600, step: 10 },

  { panel: 'net', group: '请求节奏', key: 'biliMinIntervalMs', path: 'bili.minIntervalMs', kind: 'num', label: '两次请求最少隔多久', unit: '毫秒', min: 200, max: 120000, step: 100 },
  { panel: 'net', group: '请求节奏', key: 'biliJitterMs', path: 'bili.jitterMs', kind: 'num', label: '在此基础上再随机多等', unit: '毫秒', min: 0, max: 60000, step: 100 },

  // ---------------- 鱼·说话与记忆 ----------------
  { panel: 'talk', group: '在 B 站说话', key: 'commentEnabled', path: 'comment.enabled', kind: 'bool', label: '允许在评论区说话' },
  { panel: 'talk', group: '在 B 站说话', key: 'commentPerDay', path: 'comment.perDay', kind: 'num', label: '每天评论几条（0 = 不发）', unit: '条', min: 0, max: 5, step: 1 },
  { panel: 'talk', group: '在 B 站说话', key: 'commentReplyPerDay', path: 'comment.replyPerDay', kind: 'num', label: '每天回复几条楼中楼', unit: '条', min: 0, max: 10, step: 1 },
  { panel: 'talk', group: '在 B 站说话', key: 'commentReplyToReplies', path: 'comment.replyToReplies', kind: 'bool', label: '有人回她就回一句' },
  { panel: 'talk', group: '在 B 站说话', key: 'commentScanEveryMin', path: 'comment.scanEveryMin', kind: 'num', label: '多久看一次有没有人回她', unit: '分钟', min: 5, max: 720, step: 5 },
  { panel: 'talk', group: '在 B 站说话', key: 'commentWindow', path: 'comment.window', kind: 'win', label: '只在哪个时段说话' },
  { panel: 'talk', group: '在 B 站说话', key: 'commentAtOwner', path: 'comment.atOwner', kind: 'bool', label: '评论开头 @ 你' },

  { panel: 'talk', group: '主动开口', key: 'proactiveEnabled', path: 'proactive.enabled', kind: 'bool', label: '允许她主动找你说话' },
  { panel: 'talk', group: '主动开口', key: 'proactiveMaxPerDay', path: 'proactive.maxPerDay', kind: 'num', label: '一天最多搭话几次', unit: '次', min: 0, max: 12, step: 1 },
  { panel: 'talk', group: '主动开口', key: 'proactiveIdleHours', path: 'proactive.minIdleHours', kind: 'num', label: '安静多久才搭话', unit: '小时', min: 1, max: 24, step: 1 },
  { panel: 'talk', group: '主动开口', key: 'proactiveCooldownHours', path: 'proactive.cooldownHours', kind: 'num', label: '两次之间至少隔多久', unit: '小时', min: 0, max: 72, step: 1 },
  { panel: 'talk', group: '主动开口', key: 'proactiveFoldSilent', path: 'proactive.foldSilent', kind: 'bool', label: '没开口的那轮折成一行' },
  { panel: 'talk', group: '主动开口', key: 'proactiveIdleCountsSeen', path: 'proactive.idleCountsSeen', kind: 'bool', label: '「你来了」也算打断安静' },
  { panel: 'talk', group: '主动开口', key: 'proactiveSendTools', path: 'proactive.sendTools', kind: 'list', label: '发话工具（没有就留空）' },
  { panel: 'talk', group: '主动开口', key: 'notifyEnabled', path: 'notify.enabled', kind: 'bool', label: '她说话时在系统里提醒我' },

  { panel: 'talk', group: '会话', key: 'chatRotateAfter', path: 'chat.rotateAfter', kind: 'num', label: '聊满几轮换新会话（0 = 不换）', unit: '轮', min: 0, max: 500, step: 1 },
  { panel: 'talk', group: '会话', key: 'chatCarry', path: 'chat.carry', kind: 'num', label: '换会话时带几轮原话', unit: '轮', min: 0, max: 20, step: 1 },
  { panel: 'talk', group: '会话', key: 'roomsGroupRotateDays', path: 'rooms.groupRotateDays', kind: 'num', label: '群房用几天换新（0 = 不换）', unit: '天', min: 0, max: 365, step: 1 },

  { panel: 'talk', group: '记忆', key: 'memoryDocBudget', path: 'memory.docBudget', kind: 'num', label: '身份文档字数预算', unit: '字', min: 600, max: 4000, step: 100 },
  { panel: 'talk', group: '记忆', key: 'memoryBeliefsShown', path: 'memory.beliefsShown', kind: 'num', label: '一轮里逐条摆几条判断', unit: '条', min: 1, max: 8, step: 1 },
  { panel: 'talk', group: '记忆', key: 'memoryHearEvery', path: 'memory.hearEvery', kind: 'num', label: '每几轮记一句你的原话（0 = 不记）', unit: '轮', min: 0, max: 50, step: 1 },

  { panel: 'talk', group: '规矩', key: 'rulesOffers', path: 'rules.offers', kind: 'bool', label: '允许她申请改一条规矩' },
  { panel: 'talk', group: '规矩', key: 'rulesHoldDays', path: 'rules.holdDays', kind: 'num', label: '一张申请几天不处理算搁置', unit: '天', min: 1, max: 30, step: 1 },
  { panel: 'talk', group: '规矩', key: 'rulesCooldownDays', path: 'rules.cooldownDays', kind: 'num', label: '被驳回后隔几天才能再提', unit: '天', min: 1, max: 30, step: 1 },
]

/** 面板里的三页设置。id 同时是 KNOBS 里的 panel 名；go 是面板动作名。 */
export const PAGES = [
  {
    id: 'rhythm', title: '鱼·作息', label: '作息', icon: 'clock', go: 'goRhythm',
    note: '她什么时候醒、一天经历几件事、写不写日记。',
    sub: '几点醒、写不写日记、做梦',
  },
  {
    id: 'net', title: '鱼·上网', label: '上网', icon: 'globe', go: 'goNet',
    note: '上不上 B 站、翻几条、看不看画面、什么不想看。',
    sub: 'B 站、看画面、屏蔽',
  },
  {
    id: 'talk', title: '鱼·说话与记忆', label: '说话', icon: 'chat', go: 'goTalk',
    note: '评论区说话、主动开口、换会话、记忆与规矩。',
    sub: '评论区、主动开口、记忆',
  },
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

const isTime = (v) => typeof v === 'string' && TIME_RE.test(v)
const pair = (v, dflt) => (Array.isArray(v) && v.length === 2 && isTime(v[0]) && isTime(v[1]) ? v : dflt)
const asList = (v, dflt) => (Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean) : dflt)

/** 面板显示用的当前值：扁平名 → 值。 */
export function current() {
  const raw = readRaw()
  const out = {}
  for (const k of KNOBS) {
    const val = getDotted(raw, k.path)
    if (k.kind === 'win') {
      const cur = pair(val, pair(getDotted(DEFAULTS, k.path), ['20:00', '23:00']))
      out[k.key + 'Start'] = cur[0]
      out[k.key + 'End'] = cur[1]
      if (k.follow) out[k.key + 'Follow'] = val == null
    } else if (k.kind === 'list') {
      out[k.key] = asList(val === undefined || val === null ? getDotted(DEFAULTS, k.path) : val, []).join('，')
    } else if (k.kind === 'bool') {
      const v = val === undefined || val === null ? getDotted(DEFAULTS, k.path) : val
      out[k.key] = v === true
    } else if (k.kind === 'text') {
      const v = val === undefined || val === null ? getDotted(DEFAULTS, k.path) : val
      out[k.key] = String(v ?? '')
    } else {
      const v = Number(val === undefined || val === null ? getDotted(DEFAULTS, k.path) : val)
      out[k.key] = Number.isFinite(v) ? v : Number(getDotted(DEFAULTS, k.path)) || 0
    }
  }
  return out
}

/** 面板上所有可能出现的表单键名（时段键拆成 Start/End，带 follow 的多一个 Follow）。 */
const FIELD_NAMES = new Set(KNOBS.flatMap((k) => (k.kind === 'win'
  ? [k.key + 'Start', k.key + 'End', ...(k.follow ? [k.key + 'Follow'] : [])]
  : [k.key])))

/**
 * 把表单提交拍平成「裸键名 → 值」。
 * App 端 form submit 的载荷是 { …提交参数, values: { 'data.f.<key>': 值 } }——键是控件 bind
 * 的完整路径（app/lib/ui/chat/dsh_ui/dsh_ui_plugin_controls_state.dart 的 submit()），
 * 所以键取「最后一段」再对 FIELD_NAMES；本地探针直接给 { growthDays: 7 } 或 { f: {…} } 也认：
 * 逐层往下走（深度 ≤5），谁先命中归谁。
 */
export function unwrap(value) {
  const out = {}
  const seen = new Set()
  const bare = (k) => {
    const i = k.lastIndexOf('.')
    return i >= 0 ? k.slice(i + 1) : k
  }
  const walk = (v, depth) => {
    if (v === null || typeof v !== 'object' || Array.isArray(v) || depth > 5 || seen.has(v)) return
    seen.add(v)
    for (const k of Object.keys(v)) {
      const b = bare(k)
      if (FIELD_NAMES.has(b)) {
        if (!(b in out)) out[b] = v[k]
      } else {
        walk(v[k], depth + 1)
      }
    }
  }
  walk(value, 0)
  return out
}

function writeRaw(cfg) {
  const file = FILE()
  mkdirSync(dirname(file), { recursive: true })
  const tmp = file + '.tmp'
  writeFileSync(tmp, JSON.stringify(cfg, null, 2), { mode: 0o600 })
  renameSync(tmp, file)
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

/** 逗号分隔的一行 → 字符串数组（中英文逗号、顿号、换行都认）。 */
export function parseList(text) {
  const out = []
  for (const raw of String(text ?? '').split(/[,，、\n]/)) {
    const s = raw.trim()
    if (s && !out.includes(s)) out.push(s)
  }
  return out
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
    if (k.kind === 'win') {
      const sKey = k.key + 'Start'
      const eKey = k.key + 'End'
      const fKey = k.key + 'Follow'
      if (!(sKey in v) && !(eKey in v) && !(fKey in v)) continue
      const had = getDotted(raw, k.path)
      const dflt = pair(getDotted(DEFAULTS, k.path), ['20:00', '23:00'])
      if (k.follow && v[fKey] === true) {
        // 已经是「跟作息走」（没写过，或写的是 null）就不动它
        if (had === undefined || had === null) continue
        setDotted(raw, k.path, null)
        changed += 1
        continue
      }
      const cur = pair(had, dflt)
      const a = isTime(String(v[sKey] ?? '')) ? String(v[sKey]) : cur[0]
      const b = isTime(String(v[eKey] ?? '')) ? String(v[eKey]) : cur[1]
      if (a === b) {
        notes.push(k.label + '：起止不能一样')
        continue
      }
      // 没写过这个键时，跟默认值一样就当没改
      if (!same(pair(had, dflt), [a, b])) {
        setDotted(raw, k.path, [a, b])
        changed += 1
      }
      continue
    }

    if (!(k.key in v)) continue
    const val = v[k.key]
    const had = getDotted(raw, k.path)
    // 盘上没写过的键：面板显示的是默认值，用户没动它就不该被写进去
    const base = had === undefined ? getDotted(DEFAULTS, k.path) : had

    if (k.kind === 'bool') {
      if (typeof val !== 'boolean' || base === val) continue
      setDotted(raw, k.path, val)
      changed += 1
      continue
    }

    if (k.kind === 'list') {
      const next = parseList(val)
      if (same(asList(base, []), next)) continue
      setDotted(raw, k.path, next)
      changed += 1
      continue
    }

    if (k.kind === 'text') {
      const next = String(val ?? '').trim()
      if (String(base ?? '') === next) continue
      setDotted(raw, k.path, next)
      changed += 1
      continue
    }

    const n = Number(val)
    if (!Number.isFinite(n)) {
      notes.push(k.label + '不是数字')
      continue
    }
    const step = k.step || 1
    const clamped = Math.max(k.min, Math.min(k.max, n))
    const next = step > 1 ? Math.round(clamped / step) * step : Math.round(clamped)
    if (Number(base) === next) continue
    setDotted(raw, k.path, next)
    changed += 1
  }

  if (changed > 0) writeRaw(raw)
  return { changed, notes }
}
