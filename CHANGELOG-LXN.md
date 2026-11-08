# LX-N Music 分支变更明细

> 本文件只记录本分支相对上游 [lyswhut/lx-music-mobile](https://github.com/lyswhut/lx-music-mobile) v1.9.2 的改动；上游完整历史见 [`CHANGELOG.md`](./CHANGELOG.md)。
> 括号中的数字为 Android `versionCode`，实际 arm64-v8a 版本号为 `versionCode × 1000 + 3`。

## v1.9.43（120）
- 方向确认从「每个组件一个 150ms 定时器」收敛为 `windowSizeTools` 全局单例（`stableSize` / `stableHorizontal` / `onDirectionChanged`）。
- `getRowInfo()` 只读稳定方向；列表列数 / 行宽 / 行高在 mount 时一次锁定，根治旋转时 `Changing numColumns on the fly is not supported`，不再靠 key 重建列表。
- `getItemLayout` 与 item 实际高度改为同源，修复横竖屏行高不一致。

## v1.9.42（119）
- 找到旋转白屏真正根因：`SizeView` 把 `onLayout` 过渡态尺寸写回全局，造成方向自激振荡。改用原生权威窗口尺寸 + 异步请求序号防乱序。
- `useHorizontalMode` 加入方向稳定确认，`[orientation]` 日志去重，一次旋转只写一条。

## v1.9.40 ~ v1.9.41（117 ~ 118）
- 修 `configUpdated` 监听泄漏（`off` 误写成 `on`）、`onPageSelected` 卸载后误报、设置页 switch 缺 `default`。
- 新增 Home 根树 / 设置页错误边界，异常显示文字而非白屏。
- 日志安全序列化：空异常写 `[empty error message]`，全局异常带 `[JS FATAL/NONFATAL]` 与 stack 多级兜底。
- `AndroidManifest` 的 `configChanges` 补全 `density / fontScale / layoutDirection / navigation / touchscreen / mcc / mnc`。

## v1.9.39（116）
- 关闭「全源竞速」开关及缓存优先辅助：合并优质源已按平台选好解析；保留 4 路失败/报错竞速与取链兜底。
- 播放页打开详情时底部播放条常驻，封面/歌名不再重复 push 播放页。
- 横竖屏播放页 `contentWrap` 只包内容区，详情不再覆盖播放器。

## v1.9.37 ~ v1.9.38（114 ~ 115）
- 四平台（wy / tx / kw / kg）歌手 / 专辑详情，精确接口失败按名搜索降级；新增 TX `musicu.fcg` 与歌手/专辑接口。
- 歌曲对象补 `meta.singerId`；老列表 QQ 音乐歌曲按 `song_mid` 反查并回写所有列表副本。
- 网盘上传歌曲 Cookie 播放：A 精确路由 + B 解析失败兜底；Cookie 退出普通 VIP 解析链路。
- 菜单精简：删除「分享歌曲」与「我的列表」首行「播放」，歌手/专辑详情上移。

## v1.9.32 ~ v1.9.36（109 ~ 113）
- **合并优质源**：按平台实测择优、早停、生成单个 JS 源；独立「音源设置」标签与常驻面板。
- 探测样本改为四平台实时榜单随机抓歌 + 内置曲库兜底；达标阈值可调（500~3000ms）。
- 结果归一化兼容旧落盘数据，修复音源设置页白屏；播放日志单行、四平台结果表格化。
- 合并模块目录 `core/userApi/` 与 `core/userApi.ts` 同名导致 Metro 依赖丢失，改名 `core/mergeSource/`。
- 竖屏补齐 `case 'source'`；删除结果页过时说明文字；音质上限提示改为 `当前选择音质上限：xxx`。

## v1.9.30 ~ v1.9.31（107 ~ 108）
- 移植 ALXMusic 三项思路：4 路并行竞速换源、`Range` 链接探活（改为 XHR + 三态 ok/suspect/dead）、播放器报错按音源失败直接换源。
- 新增音源健康度与冷却、统一竞速调度器 `raceDynamic`；一度加入的全源竞速开关与健康面板后续在 v1.9.33 / v1.9.39 移除。
- 内置源从旧 22 个换成 8 个优质源，旧源按名精确清理，用户手动导入的源保留；首次安装默认「安妮独家音源」。
- **明确不移植下载功能**，并裁掉上游的下载优先分支。

## v1.9.22 ~ v1.9.29（99 ~ 106）
- 统一详情入口：`detailStacks` 双宿主（home / playDetail）、`DetailManager` 通用化、横竖屏返回与覆盖层修复。
- 歌手/专辑/歌单头部海报与简介紧凑化，最终改为固定高度；横屏名称与按钮同行。
- 列表行高定型：竖屏 48 / 横屏 40；横屏双列布局随方向正确切换。
- v1.9.28 因误改竖屏行高整版作废，产物已删除，请勿分发。

## v1.9.14 ~ v1.9.21（91 ~ 98）
- 详情改为框架内嵌栈，歌单详情嵌入式展示；详情内点「歌单」可搜索网易云歌单。
- 恢复扫码登录并修好 Hermes 的 `TextEncoder` polyfill、二维码 `chainId` 风控与 Set-Cookie 提取。
- 网易云离线缓存三键（每日推荐 / 我的歌单 / 歌单歌曲）与 Cookie 失效提示；重试失败弹窗抑制。
- 移除「关于 LX MUSIC」分类。

## v1.9.9 ~ v1.9.13（86 ~ 90）
- 内置自定义源自动导入机制（初版 22 源，后于 v1.9.30 换成 8 源）。
- 网易云 LOGO 线性化并按墨迹占比像素级对齐；横屏播放页按钮列对齐竖屏四按钮。

## v1.9.1 ~ v1.9.8（78 ~ 85）
- 移植网易云增强 API 层：账号 / 每日推荐 / Cookie / 歌手 / 专辑 / MV / 评论 / 音质详情。
- 新增「网易云增强」设置与「我的网易云」视图（后精简为每日推荐 + 我的歌单两个 Tab）；扫码 / 网页 / Cookie 登录。
- 修双格式数据转换白屏、歌单接口废弃、歌单 kind 归一化、网页登录轮询守卫。
- 评论、红心、相似歌曲、播放历史打卡、MV / 视频播放、不喜欢歌曲。
- 禁用版本更新检查与更新下载，设置页移除「版本」分类；协议弹窗倒计时 20s → 3s。
