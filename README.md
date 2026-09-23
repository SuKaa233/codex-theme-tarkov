# Codex Tactical SFX

给 Codex 桌面客户端和 Codex CLI 使用的事件音效插件。它的主体不是换色或宠物，而是把 Codex 的生命周期事件路由成不同声音：

| Codex 事件 | 默认音效 | 触发时机 |
| --- | --- | --- |
| `Stop` | `done.m4a` | 主任务的一轮回复真正停止时 |
| `PermissionRequest` | `approval.m4a` | Codex 即将弹出命令、网络或工具授权时 |
| `PostToolUse` | `error.m4a` | 本地工具返回非零退出码或结构化错误时 |
| `Interrupt` | `error.m4a` | 用户中止正在执行的任务时 |

事件接入使用 Codex 官方 [Hooks](https://learn.chatgpt.com/docs/hooks)，不注入 Electron、不替换客户端文件，也不轮询内部数据库。三个 M4A 文件从参考项目逐字节复制，默认音量同为 70%；测试会锁定 SHA-256，防止日后被合成音或近似音替换。

## 安装

需要 Node.js 18+ 和支持 Hooks 的新版 Codex。在终端执行：

```powershell
codex plugin marketplace add SuKaa233/codex-theme-tarkov
codex plugin add codex-theme-tarkov@codex-tactical-audio
```

然后重启 Codex 或新建一个任务，输入 `/hooks`，检查并信任 **Codex Tactical SFX** 的四个 Hook。Codex 会按 Hook 内容的哈希记录信任；Hook 后续发生修改时需要重新确认。这是官方对非托管 Hook 的安全要求。

安装后可先试听：

```powershell
npm run preview:complete
npm run preview:approval
npm run preview:error
npm run preview:interrupt
```

试听命令适合克隆本仓库后的开发环境；实际运行时由 Codex 自动触发。

## 音效系统

核心实现位于 [hooks/sound-hook.mjs](hooks/sound-hook.mjs)：

- 从标准输入读取 Codex 官方 Hook JSON，而不是解析不稳定的聊天记录；
- 后台播放，不阻塞任务或改变模型上下文；
- 每个会话和任务按事件类型设置冷却，避免重复提示轰炸；
- Windows 使用隐藏的 `System.Windows.Media.MediaPlayer`，macOS 使用 `afplay`，Linux 使用 `ffplay`；
- 支持 `0` 到 `1` 的播放器音量，默认 `0.7`，不会改写原始 M4A 字节；
- 单个事件可配置多个音频文件，按会话/任务稳定选择其中一个；
- 播放器或文件异常只写可选调试日志，不会把 Codex 的工作流标记为失败。

失败音效只覆盖官方 `PostToolUse` 能观察到的本地工具路径，例如 Bash、`apply_patch`、MCP 和本地函数工具。托管工具没有经过这一 Hook，模型本身或网络层的所有错误也没有统一的失败事件，因此本项目不会声称捕获了每一种 Codex 错误。

## 自定义声音与音量

Windows 用户可从仓库创建个人配置：

```powershell
./scripts/configure.ps1
```

配置位置默认是 `%USERPROFILE%\.codex\codex-tarkov-sfx.json`。也可以用环境变量 `CODEX_TARKOV_SFX_CONFIG` 指向任意 JSON 文件。示例：

```json
{
  "volume": 0.5,
  "events": {
    "complete": {
      "sounds": ["D:\\My Sounds\\done.wav"]
    },
    "approval": {
      "enabled": false
    }
  }
}
```

默认文件为 M4A；自定义文件只要系统播放器支持即可。可配置事件为 `complete`、`approval`、`error` 和 `interrupt`；每项支持 `enabled`、`sounds`、`cooldownMs`。完整默认值见 [config/default.json](config/default.json)。修改配置后重启 Codex。

## 开发与验证

```bash
npm test
```

测试会完成以下检查：

- 校验三个 M4A 的容器头、大小和上游 SHA-256；
- 用模拟 Hook JSON 验证四类事件路由及成功工具不误报；
- 校验插件清单、Hook 配置、市场入口和 M4A/MP4 容器头；
- 继续校验附带的桌面端与 CLI 主题。

手动查看某个事件的路由结果而不播放声音：

```powershell
'{"hook_event_name":"Stop","session_id":"demo","turn_id":"1"}' |
  node ./hooks/sound-hook.mjs --dry-run
```

## 可选视觉附属

仓库仍保留初版的 Night Raid / Paper Map 桌面主题、CLI `.tmTheme` 和宠物提示词，但它们不参与音效插件运行。需要时再查看：

- 桌面主题字符串：[desktop](desktop)
- CLI 主题：[themes](themes)
- 视觉设计说明：[docs/design.md](docs/design.md)
- 可选宠物提示词：[pet/PET_PROMPT.md](pet/PET_PROMPT.md)

旧的 [scripts/install.ps1](scripts/install.ps1) 只负责安装这些可选视觉主题。

## 与参考项目的关系

本项目的三段默认音频直接来自 [ZHIGENGNIAO258/dsh-theme-tarkov](https://github.com/ZHIGENGNIAO258/dsh-theme-tarkov)：`done.m4a`、`approval.m4a`、`error.m4a`。参考项目依赖 DeepSeek Harness 的 Host 路由和浏览器注入点，不能直接用于 Codex；这里仅把同一音频和同一三类语义映射移植到 Codex 官方 Hooks。具体文件哈希、来源提交和许可文本见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

## 兼容性

- 已按 Codex Hooks 当前的 `Stop`、`PermissionRequest`、`PostToolUse`、`Interrupt` 输入契约实现；
- Windows 播放链路使用系统自带 PowerShell 与 WPF MediaPlayer，macOS 使用 `afplay`，Linux 需要 `ffplay`；
- Hook 命令要求 `node` 在 Codex 进程可见的 `PATH` 中；
- 主题附属仍兼容 Codex Windows `26.915.4065.0` 和 CLI `0.150.1` 的已验证格式。

## 声明与许可

这是非官方社区项目，与 OpenAI、DeepSeek 或 Battlestate Games 无隶属关系。“Codex”“Escape from Tarkov”等名称与商标归各自权利人所有。本项目代码采用 MIT License；复制的三段音频按上游仓库声明的 MIT License 再分发，详见第三方声明。上游没有为这些音频单独列出来源或额外授权证明。
