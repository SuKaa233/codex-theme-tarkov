# Tactical Beacon pet prompt

在 Codex 中打开 **Settings > Pets > Create pet**。应用会安装并调用官方 `hatch-pet` 技能，然后打开一个新任务。把下面整段提示词发送给它：

```text
Create an original custom Codex pet named Beacon-7. It is a compact, friendly tactical field drone with a squat olive-drab body, a warm amber status lamp, two tiny articulated antennae, rubberized feet, and a small off-white Codex-like geometric marking that is not an existing logo. The design should feel like rugged field equipment from a fictional extraction expedition, but must not copy any character, helmet, logo, weapon, or asset from an existing game.

Use the Codex custom-pet sprite-sheet contract exactly. Keep the silhouette readable at small desktop-overlay sizes. Use the Codex Field Kit palette: near-black olive #151711, warm off-white #E5E2D4, amber #C4A35A, signal green #7FA45A, alert red #D4645C, and muted violet #B29ACB. Give each activity state a clear animation: calm idle scan, energetic running/work loop, amber blinking needs-input loop, green ready pulse, and red blocked/error wobble. Respect reduced-motion behavior with a strong still frame. Use a transparent background and avoid text.
```

生成完成后回到 **Settings > Pets**，点击 **Refresh** 并选择 `Beacon-7`。自定义宠物保存在本机，不会自动同步到 Web。
