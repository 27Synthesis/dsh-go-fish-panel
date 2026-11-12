# 鱼·观测台 · dsh-fish 的手机面板

给 [DSH Go](https://github.com/deepseek-ai) 手机 App 用的原生小插件，把 **dsh-fish（大肥鱼）** 这个 AI 陪伴插件在手机上看不见的部分补出来：

- **看**她这段时间过得怎么样：醒了几轮、长成什么样、最近说了什么；
- **改**她的作息与脾气：25 项设置直接在手机上开关、填数字，不用去命令行手改 JSON。

dsh-fish 本身在桌面版 Harness 里有「设置 → 鱼」的界面，但手机 App 没有这个入口，配置文件又在 `~/.dsh-fish/config.json` 里，出门在外想调一下几乎不可能。这个插件就是补这一角。

> 它**不修改** dsh-fish 的任何代码，只读它落在盘上的数据、写它自己的配置文件。

---

## 两块面板

### 鱼·观测台（只读）

直接读 `$DSH_FISH_HOME`（默认 `~/.dsh-fish`）下的 `home.json`、`talk-recent.json`、`events.jsonl`：

| 区域 | 内容 |
| --- | --- |
| 三个数字 | 轮数、成长记录条数、建家时间 |
| 现在 / 上次说话 | 她家里的标题、最后一次开口的时间 |
| 最近她说的 | 最近 5 条 `utterance` / `voice` 事件 |
| 成长记录 | 最近 8 条各种事件（听到的话会淡一档） |
| 按钮 | 刷新、设置（跳到设置面板） |

### 鱼·设置（能改）

五组共 25 项，改完点「保存设置」，下一次她醒来就按新的来：

| 分组 | 项 | 范围 / 默认 |
| --- | --- | --- |
| 作息 | 每天醒几次 `wakesPerDay` | 0–4，默认 1 |
| | 醒来的开始 / 结束 `window` | 时间选择，默认 20:00–23:00，两个不能一样 |
| | 成长周期（天）`growthDays` | 7–180，默认 30 |
| 刷站与画面 | 自己逛 B 站 `browse.enabled` | 默认开 |
| | 每天逛几次 `browse.perDay` | 0–4，默认 1 |
| | 一次看几条 `browse.topN` | 1–20，默认 4 |
| | 读评论区里别人的话 `browse.voices` | 默认开 |
| | 能看视频画面 `video.enabled` | 默认开 |
| | 每天看几条画面 `video.perDay` | 0–6，默认 2 |
| 说话与日记 | 允许她发评论 `comment.enabled` | 默认关 |
| | 每天最多发几条 `comment.perDay` | 0–5，默认 1 |
| | 有人回她就回一句 `comment.replyToReplies` | 默认开 |
| | 她每天写日记 `diary.enabled` | 默认开 |
| | 日记给你看 `diary.visible` | 默认关 |
| 她自己 | 主动性 `drive.enabled` | 默认开 |
| | 兴趣 `interest.enabled` | 默认开 |
| | 会做梦 `dream.enabled` | 默认开 |
| | 会主动找你说话 `proactive.enabled` | 默认关 |
| | 一天最多主动开几次 `proactive.maxPerDay` | 0–12，默认 2 |
| 会话与网 | 聊满几轮换新会话 `chat.rotateAfter` | 0–500，默认 40 |
| | 换会话时带几轮原话 `chat.carry` | 0–20，默认 4 |
| | 身份文档字数预算 `memory.docBudget` | 600–4000，默认 2400 |
| | 彻底断网 `bili.enabled` | 默认开 |
| | 桌面提醒 `notify.enabled` | 默认关 |

**保存的行为**（`lib/cfg.js` 的 `applyForm`）：

- 只写**真的变了**的键，没改的一项都不碰，其余键原样保留（包括插件不认识的键）；
- 数字四舍五入后夹在 dsh-fish 自己的上下限里，超范围会按边界存；
- 开始和结束时间相同 → 不写，弹一句「起止时间不能一样」；
- 写盘用「临时文件 + rename」，权限 `0600`，写一半断电也不会留下半个 JSON；
- `~/.dsh-fish/config.json` 不存在时面板显示 dsh-fish 的默认值，**只有你改了才创建文件**。

## 装

插件目录放进 dsh-go 的插件目录，然后加进 profile：

```bash
cp -r dsh-go-fish-panel "$DSH_HOME/dsh-go/plugins/local-fish-panel"
dsh plugin --profile web add "$DSH_HOME/dsh-go/plugins/local-fish-panel"
```

**改完 `lib/` 之后必须在 App 的「引擎」页重启一次引擎**——dsh-go 原生插件没有热重载。

装好后面板出现在三处：会话详情页的页签、全部功能页、以及对话详情里；输入框上方还会多一个 ❤ 胶囊直接打开观测台。

## 配置在哪

- 数据与配置根目录：`$DSH_FISH_HOME`，默认 `~/.dsh-fish`
- 插件只读：`home.json`、`talk-recent.json`、`events.jsonl`
- 插件只写：`config.json`

dsh-fish 每次 `loadConfig()` 都重新从盘上读，所以保存设置**不需要重启 dsh-fish 本身**，她下一次醒来自动按新配置跑。

## 代码结构

```text
lib/index.js   两块面板的视图与动作（dsh-go v2 面板 API）
lib/cfg.js     25 个开关的描述、读配置、写配置、夹紧与校验
package.json   插件清单：dshGo.contributes.panels 声明两块面板与胶囊
```

想加一项设置：在 `lib/cfg.js` 的 `KNOBS` 里加一条 `{ key, path, kind, label, min, max, step }`，再到 `lib/index.js` 的 `GROUPS` 里把它排进某一组即可，视图是按数据生成的。

## 关于手机面板的限制

dsh-go 的原生面板有预算：一个面板 ≤ 32768 字节、≤ 120 个节点、嵌套 ≤ 8 层。一个输入控件大约折 3.5 个节点，所以 25 个控件已接近上限——这也是设置面板没有给每一组加更花哨的卡片的原因。继续加项时要留意这个数。

## 许可

MIT。

---

用起来有问题：这些面板只是读写 dsh-fish 自己的文件，出问题先看 `~/.dsh-fish/config.json` 是不是合法 JSON，再看一眼 App 的「引擎」页日志。
