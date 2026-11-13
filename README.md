# 鱼·观测台 · dsh-fish 的手机面板

[dsh-go-fish-panel](https://github.com/27Synthesis/dsh-go-fish-panel) · MIT

给 [DSH Go](https://github.com/deepseek-ai) 手机 App 用的原生小插件，把 **dsh-fish（大肥鱼）** 这个 AI 陪伴插件在手机上看不见的部分补出来：

- **看**她这段时间过得怎么样：醒了几轮、最近说了什么、成长记录到哪一步；
- **改**她的作息、上网和说话的规矩：57 项设置直接在手机上开关、填数字、选时间。
- **听她自己**。

dsh-fish 本身在桌面版 Harness 里有「设置 → 鱼」的界面，但手机 App 没有这个入口，配置文件又在 `~/.dsh-fish/config.json` 里，出门在外想调一下几乎不可能。这个插件就是补这一角。

> 它**不修改** dsh-fish 的任何代码：只读她落在盘上的数据，按 dsh-fish 自己的默认值与上下限写它的配置文件，并且只写你**真的改过**的键。

---

## 一个面板，里面自己翻页

dsh-go 把一个 panel 画成一张卡：拆成四块就是四张卡，侧边栏一滚就没头；而一个视图最多 32 个输入控件，57 个开关也塞不进一页。所以只留**一个**面板「鱼·观测台」，页码记在插件自己的模块里，三页设置在面板内部翻——动作返回 `refresh: true`，面板就重画成另一页。

### 第一页：观测台（只读 + 四个常用开关）

读 `$DSH_FISH_HOME`（默认 `~/.dsh-fish`）下的 `home.json`、`talk-recent.json`、`events.jsonl`：

| 区域 | 内容 |
| --- | --- |
| 三个数字 | 轮数、成长记录条数、建家时间 |
| 现在 / 上次说话 | 她家里的标题、最后一次开口的时间 |
| 常用开关 | 最常动的四个：上 B 站、做梦、写日记、主动找你 |
| 设置 | 三行入口：作息 / 上网 / 说话与记忆 |
| 最近她说的 | 最近 5 条 `utterance` / `voice` 事件 |
| 成长记录 | 最近 8 条各种事件（`heard` 淡一档显示） |
| 侧边栏 | 「放进侧边栏」开关（只改 `ui.json` 里这个插件的座位） |
| 按钮 | 刷新 |

### 另外三页：设置（能改）

分成三页也是因为预算（见文末）：一页塞 57 个控件会超。每页末尾是「回观测台」加另外两页的入口；保存后弹一句「已保存 N 项」，没改就弹「没有改动」。

**鱼·作息**（17 项，3 组）

| 组 | 项 |
| --- | --- |
| 成长 | 成长周期 `growthDays`（7–180，默认 30）· 冷落多少天才算疏远 `absenceAfterDays`（1–30，默认 2）· 每天醒几次 `wakesPerDay`（0–4，默认 1）· 每天几点醒 `window`（时间，默认 20:00–23:00）· 每天最多推几条成长事件 `daily.events`（0–6，默认 2）· 其中「她问你」最多几条 `daily.questions`（0–6，默认 1）· 她一轮最多写多少字 `chat.replyChars`（0–2000，默认 0 = 不限） |
| 日记 | 她每天写日记 `diary.enabled`（默认开）· 日记给你看 `diary.visible`（默认关）· 日记留多久 `diary.keepDays`（0–3650，默认 0 = 永久） |
| 她自己的事 | 多久让她回头想一次 `memory.sleepEveryDays`（0–60，默认 7）· 总共留几条自述 `memory.sleepKeep`（0–100，默认 12）· 空醒时自己找点事做 `memory.selfWake`（默认开）· 身份段末尾摆一句她最近说的 `memory.echo`（默认开）· 主动性 `drive.enabled` · 兴趣 `interest.enabled` · 会做梦 `dream.enabled`（三项默认都开） |

**鱼·上网**（16 项，5 组）

| 组 | 项 |
| --- | --- |
| 能不能上网 | 允许她上网 `bili.enabled`（默认开，关掉 = 彻底断网）· 按时间自动替她逛一圈 `browse.enabled`（默认开）· 上网时间段 `browse.window`（默认「跟着作息走」，可以单独设） |
| 逛多少 | 每天最多刷几次 `browse.perDay`（0–4，默认 1）· 每次翻几条 `browse.topN`（1–20，默认 4）· 每条读几条热评 `browse.deepRead`（0–20，默认 6）· 每条抽几条弹幕 `browse.danmaku`（0–30，默认 6）· 记下评论区的一句话 `browse.voices`（默认开） |
| 看画面 | 允许看视频画面 `video.enabled`（默认开）· 每天看几条 `video.perDay`（0–6，默认 2）· 每条取几帧 `video.frames`（4–16，默认 9） |
| 不想看的 | 屏蔽关键词 `avoid.keywords`（逗号隔开，默认 恐怖/血腥/鬼畜/政治）· UP 主黑名单 `avoid.upMids` · 太短的不看 `avoid.minDuration`（0–3600 秒，默认 60） |
| 请求节奏 | 两次请求最少隔多久 `bili.minIntervalMs`（200–120000 毫秒，默认 800）· 在此基础上再随机多等 `bili.jitterMs`（0–60000，默认 500） |

**鱼·说话与记忆**（24 项，5 组）

| 组 | 项 |
| --- | --- |
| 在 B 站说话 | 允许在评论区说话 `comment.enabled`（默认关）· 每天评论几条 `comment.perDay`（0–5，默认 1）· 每天回复几条楼中楼 `comment.replyPerDay`（0–10，默认 2）· 有人回她就回一句 `comment.replyToReplies`（默认开）· 多久看一次有没有人回她 `comment.scanEveryMin`（5–720 分钟，默认 30）· 只在哪个时段说话 `comment.window`（默认 20:00–23:00）· 评论开头 @ 你 `comment.atOwner`（默认开） |
| 主动开口 | 允许她主动找你说话 `proactive.enabled`（默认关）· 一天最多搭话几次 `proactive.maxPerDay`（0–12，默认 2）· 安静多久才搭话 `proactive.minIdleHours`（1–24，默认 6）· 两次之间至少隔多久 `proactive.cooldownHours`（0–72，默认 4）· 没开口的那轮折成一行 `proactive.foldSilent`（默认开）· 「你来了」也算打断安静 `proactive.idleCountsSeen`（默认关）· 发话工具 `proactive.sendTools`（留空 = 只认正文）· 她说话时在系统里提醒我 `notify.enabled`（默认关） |
| 会话 | 聊满几轮换新会话 `chat.rotateAfter`（0–500，默认 40）· 换会话时带几轮原话 `chat.carry`（0–20，默认 4）· 群房用几天换新 `rooms.groupRotateDays`（0–365，默认 7） |
| 记忆 | 身份文档字数预算 `memory.docBudget`（600–4000，默认 2400）· 一轮里逐条摆几条判断 `memory.beliefsShown`（1–8，默认 3）· 每几轮记一句你的原话 `memory.hearEvery`（0–50，默认 3） |
| 规矩 | 允许她申请改一条规矩 `rules.offers`（默认开）· 一张申请几天不处理算搁置 `rules.holdDays`（1–30，默认 3）· 被驳回后隔几天才能再提 `rules.cooldownDays`（1–30，默认 3） |

默认值与上下限**逐条对齐** dsh-fish 的 `lib/settings.js`（`DEFAULTS` 与 `LIMITS`）。

## 保存的行为（`lib/cfg.js` 的 `applyForm`）

- 只写**真的变了**的键：盘上没写过、面板显示默认值、你也没动它 → 不写；其余键原样保留，包括插件不认识的键（dsh-fish 自己的 `tools`、`outing`、`observe`、`ui` 等都不会被吃掉）。
- 数字四舍五入后夹在 dsh-fish 自己的上下限里，超范围按边界存；带步长的项按步长取整。
- 时段两个都得是合法 `HH:MM` 且不能一样，否则不写、弹一句「起止不能一样」。
- 「上网时间段」勾上「跟着作息走」写 `null`（dsh-fish 认得这个语义：跟醒来时段同一份），取消勾选才写出具体时间。
- 列表项认中英文逗号、顿号、换行，自动去重去空。
- 写盘用「临时文件 + rename」，权限 `0600`，写一半断电也不会留下半个 JSON。
- `config.json` 不存在时面板显示默认值，**只有你改了才创建文件**；坏成非 JSON 时按空配置显示，不动你的文件。

## 装

```bash
git clone https://github.com/27Synthesis/dsh-go-fish-panel "$DSH_HOME/dsh-go/plugins/local-fish-panel"
dsh plugin --profile web add "$DSH_HOME/dsh-go/plugins/local-fish-panel"
```

已经 clone 到别处也行：把目录 `cp -r` 到 `$DSH_HOME/dsh-go/plugins/local-fish-panel`，再 add 同一个路径。

更新：

```bash
git -C "$DSH_HOME/dsh-go/plugins/local-fish-panel" pull
```

**改完 `lib/` 之后必须在 App 的「引擎」页重启一次引擎**——dsh-go 原生插件没有热重载。

装好后这块面板只出现在「设置 → 插件 → 鱼·观测台」的插件详情页里；输入框上方还会多一个 ❤ 胶囊直接打开它。

挂载位由 `package.json` 里的 `dshGo.contributes.panels[].placement` 决定，可用值：`session.tab`（会话详情页签）、`features`（全部功能页）、`chat.panel`（对话详情）、`plugin`（插件详情页）。想让它出现在会话页签里，就把 `placement` 改成 `["session.tab"]`。

## 配置在哪

- 数据与配置根目录：`$DSH_FISH_HOME`，默认 `~/.dsh-fish`
- 插件只读：`home.json`、`talk-recent.json`、`events.jsonl`
- 插件只写：`config.json`

dsh-fish 每次 `loadConfig()` 都重新从盘上读，所以保存设置**不需要重启 dsh-fish 本身**，她下一次醒来自动按新配置跑。

## 代码结构

```text
lib/index.js   一个面板的视图与动作：观测台 / 三页设置 / 翻页（dsh-go v2 面板 API）
lib/cfg.js     57 个开关的描述、读配置、写配置、夹紧与校验
package.json   插件清单：dshGo.contributes.panels 声明面板与胶囊
```

想加一项设置：在 `lib/cfg.js` 的 `KNOBS` 里加一条
`{ panel: 'rhythm'|'net'|'talk', group, key, path, kind: 'num'|'bool'|'text'|'list'|'win', label, min, max, step, unit, follow }`，
视图会按数据自动生成——分组按 `group` 首次出现的顺序排，同组的会聚到一个可折叠段里。

## 关于手机面板的限制

dsh-go 的原生面板有预算：一个面板 ≤ 32768 字节、≤ 120 个节点、嵌套 ≤ 8 层，**一页最多 32 个输入控件**。所以虽然只有一个面板，每次也只渲染当前那一页：「观测台」5 个控件（全是开关），「作息」18 个，「上网」18 个，「说话与记忆」25 个。继续往一页里加项要先算这个数，超了就把组挪到另一页。

## 检查器会提示的一行

`kit/bin/check.mjs` 对每个 v2 视图都会报「view.accent dark #3D6FD6 已校正为 #698FDF，对比度至少 4.5:1」。这是 **dsh-go 自己的行为**：深色底上它会把默认强调色（雾蓝）往白里混到对比度够 4.5:1，报的是校正后的值。一个颜色在数学上不可能同时满足白底和深底的 4.5:1，所以凡是用默认强调色的 v2 视图都会有这一条，不用改。

## 许可

MIT。

---

用起来有问题：这些面板只是读写 dsh-fish 自己的文件。出问题先看 `~/.dsh-fish/config.json` 是不是合法 JSON，再看一眼 App 的「引擎」页日志；还是不行就开个 [issue](https://github.com/27Synthesis/dsh-go-fish-panel/issues)。
