# Design notes

## Direction

Codex Field Kit 把“撤离行动中的便携终端”作为核心隐喻：低饱和军绿背景、旧纸地图浅色面、琥珀色交互焦点，以及克制的状态色。界面保持 Codex 原生布局与交互，只替换官方允许分享的主题令牌。

## Desktop tokens

| Token | Night Raid | Paper Map | Rationale |
| --- | --- | --- | --- |
| `surface` | `#151711` | `#E9E4D2` | 夜间终端 / 旧纸地图 |
| `ink` | `#E5E2D4` | `#262920` | 暖白荧光 / 炭黑墨迹 |
| `accent` | `#C4A35A` | `#65773A` | 琥珀仪表 / 军绿批注 |
| `contrast` | `72` | `52` | 深色模式强调层级，浅色模式保留纸张柔和感 |
| `diffAdded` | `#7FA45A` | `#416B35` | 安全、确认、新增 |
| `diffRemoved` | `#D4645C` | `#9D423C` | 危险、错误、删除 |
| `skill` | `#B29ACB` | `#6F5687` | 与操作状态区分的特殊能力色 |
| `opaqueWindows` | `false` | `false` | 保留支持系统上的原生半透明侧栏 |

主文字与主背景的 WCAG 对比度由 `npm test` 自动检查，要求至少 `7:1`。

## Typography

- UI：`Segoe UI Variable` → `Segoe UI` → `Inter` → `sans-serif`
- Code：`Cascadia Code` → `Cascadia Mono` → `Consolas` → `monospace`

这些值是 CSS 字体回退栈；缺少首选字体时会自然回退，不需要仓库分发字体文件。

## Product boundaries

Codex 桌面端的官方主题分享格式只覆盖颜色、对比度、字体、透明窗口偏好和内置代码主题选择。它不提供全局 DOM 注入、背景音乐或任意状态文案替换。

因此本项目使用：

- 官方 `codex-theme-v1:` 分享字符串处理桌面外观；
- 官方 `.tmTheme` 入口处理 CLI 语法色；
- 官方自定义宠物工作流提供匹配的角色体验；
- 不修改签名应用、不补丁 `app.asar`、不依赖内部 CSS 类名。
