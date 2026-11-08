# 合并优质源：实现说明

> 本文件给想读代码的开发者看。普通用户请直接看 [README](../README.md) 里的「合并优质源到底是怎么做的」。

## 运行时约束：为什么必须生成「一个」JS

1. `setApiSource(id)` → `setUserApi(id)` → 原生 `loadScript()` 只加载单个脚本，加载新脚本前会 `destroy()` 旧实例；`common.apiSource` 是单值。
2. `user-api-preload.js` 里 `events = { request: null }`，`on('request', handler)` 是覆盖式赋值，多脚本各自注册只有最后一个生效。
3. `isInitedApi` 置位后再次 `send('inited')` 会直接 reject。

因此不能让多个源同时挂在一个 QuickJS 实例里，只能把若干源脚本原文塞进同一文件，由外层做「一个 request 监听器 + 一次 inited」。另外 `config/setting.ts` 的 `mergeSetting` 只接受 `string / boolean / number`，对象/数组会被丢弃，路由表无法落盘，**合并脚本本身就是配置**。

## 输入与参数

| 项 | 值 |
|---|---|
| 候选源 | 当前源排第一，其余按自定义源列表原顺序；排除旧的「合并优质源」 |
| 平台 | `wy` 网易云 / `tx` QQ 音乐 / `kw` 酷我 / `kg` 酷狗（不声明 mg、local） |
| 音质上限 | `player.playQuality`，阶梯 `128k / 320k / flac / flac24bit`，取所选档及以下 |
| 达标阈值 | `player.mergeSpeedLimit`，500 / 1000 / 1500 / 2000 / 2500 / 3000 ms，默认 1000 |
| 超时 | 歌单抓取 6s、单次取链 6s、源初始化 8s |
| 注册轮询 | 每 100ms，全部就绪或等待满 2500ms 后 `finish()` |

`user-api-preload.js` 的 `supportQualitys` 白名单最高到 `flac24bit`，与「所选档及以下」的阶梯天然兼容，无需改 preload。

## 流程

1. `prepareProbeSongs()` 每轮只调用一次：四平台用 `leaderboard.getList(bangId, 1)` 从内置榜单随机抓 1 首，6s 超时或失败回退 `probeSongs.json`（每平台 40 首）。本轮所有源共用同一批歌。
2. 逐个 `switchTo(api.id)`：清空 `global.lx.apis/qualityList` → `setApiSource(id)` → 等待 init → 额外 180ms 给异步注册留余量。
3. 每个源只测 `MERGE_PLATFORMS.filter(p => !winners[p])`；四个平台全定即 `break`（顺序早停）。
4. 优质判定只有两个条件：`probePlatform()` 返回的 URL 是合法 `http(s)` 字符串，且 `r.ms < speedLimit`。**不校验真实码率**，音质靠「只请求所选档 + 声明档位求交」约束。
5. 仍未拿下的平台用 `candidates[0]` 兜底（`kind: 'fallback'`），并一起内嵌，保证四平台都有解析能力。
6. `buildMergedScript()` → 删除旧合并源 → `addUserApi()` → `setApiSource()`，切换为当前源。失败或取消会回到 `originalApiId`。

计数：`scannedSources` 含 init 失败的源；`attempts` 是「源 × 待定平台」的实际探测次数；`hitCount` 是实测达标平台数。

## 单文件内部结构（`buildMergedScript`）

- 产物头部带 `/*! @name 合并优质源 ... */`，供 `addUserApi()` 解析。整体包在一个 IIFE 内，不加 `'use strict'`。
- **闭包隔离**：每个源原文放进 `;(function (globalThis) { <源脚本> }).call(fakeGlobal, fakeGlobal)`；`fakeGlobal = Object.create(globalThis)` 继承真实全局，`lxShim = Object.assign({}, REAL_LX)`，再用 `Object.defineProperty(fakeGlobal, 'lx', { value: lxShim })` 覆盖。真实 `globalThis.lx` 被 preload 冻结，不能直接改。形参名就叫 `globalThis`，脚本里的 `globalThis.lx` 自动指向 shim。
- **只捕获不真发**：`lxShim.on('request')` 存入 `handlers[i]`，`lxShim.send('inited')` 存入 `declared[i]`，不触碰真实单槽与一次性标志。
- **唯一入口**：外层只注册一次 `REAL_LX.on('request')`，按 `payload.source` 查 `ROUTE` 分发到对应 handler，并让它在自己的 shim 上下文执行；目标源未就绪时借用第一个已就绪源。
- **一次 inited**：`finish()` 用 `sent` 布尔锁保证唯一一次 `send('inited', { sources })`；每平台 `qualitys = 用户上限阶梯 ∩ 该源声明档位`，交集为空兜底 `['128k']`，preload 再与白名单求交。
- `ROUTE` / `CEILING` 直接固化在生成的代码里；`currentScriptInfo` 带上 `name` 与脚本头部注释，兼容依赖头部注解的源。

## 结果、还原与兼容

- 落盘键 `@merge_quality_sources_result_v1`；`normalizeMergeResult()` 给 v1.9.33 之前的旧结果补齐 `probeSongs / scannedSources / totalSources / hitCount / embedded` 并标记 `legacy`（修过 `undefined.map` 导致的设置页白屏）；`clearMergeResult()` 可清除异常数据。
- 「还原」读 `originalApiId` 切回合并前的源，合并源本身保留在列表里。
- 生成的是源脚本**原文快照**，源更新不会自动跟随，需重新合并。
- 探测全程走自定义源的 `getMusicUrl`，不经过网易云 Cookie 分支；合并脚本不读取、不存储任何 Cookie。

## 已知边界

- 每平台每轮 1 首歌、1 个音质档、1 次取链；网络波动、歌单接口与源可用性都会影响结果。
- 顺序早停优化的是切源次数与请求数，不是全局最优；v1.9.39 起全源竞速已关闭，不会并发比速。
- 阈值放宽只会让更多源达标，不会提高音质。
- 扫描期间反复切源会销毁/重建 QuickJS 实例，可能打断播放，确认弹窗已提示。
- 自定义源运行在受限 QuickJS 环境：`lx` 被冻结，只有 `setTimeout`，`eval` / 动态 `Function` 被禁用。这也是不能直接改真实 `lx`、也不能按平台切片源脚本的原因。

## 主要代码位置

| 文件 | 作用 |
|---|---|
| `src/core/mergeSource/mergeSources.ts` | 扫描、早停、结果落盘、导入与还原 |
| `src/core/mergeSource/mergeScript.ts` | 生成单 JS（shim / 路由 / inited / 音质求交） |
| `src/core/mergeSource/mergeProbeSongs.ts`、`probeSongs.json` | 实时榜单抓歌与内置兜底曲库 |
| `src/screens/Home/Views/Setting/settings/Source/MergeSources.tsx` | 面板、阈值下拉、播放日志、结果表格 |
| `android/app/src/main/assets/script/user-api-preload.js` | 自定义源运行时（单槽、一次性 inited、音质白名单） |
| `src/config/setting.ts` | `mergeSetting` 的 primitive 限制 |
