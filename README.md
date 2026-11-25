# Pixmage（像素法師）

> **粉絲自製、非官方、非營利。** Pixmage 與 Anthropic 沒有任何關係，也沒有得到 Anthropic 的認可或贊助。Clawd 是 Anthropic 的角色，這裡只是出於喜愛做的同人作品。如果權利人希望下架，請開 issue 通知，我們會立即移除。
>
> **Fan-made, unofficial and non-commercial.** Pixmage is not affiliated with, endorsed by or sponsored by Anthropic. Clawd is Anthropic's character; this is a fan work made out of affection. If the rights holder asks, we will take it down at once: please open an issue.

在 Claude Code 輸入框上方的像素小世界。Claude 每呼叫一次工具，就有一隻怪物出現：呼叫成功，小法師 Clawd 就用對應的魔法打倒牠；權限被拒絕時，Clawd 會升起蜂巢結界。打倒怪物可以得到經驗值、升級，同一台電腦上的所有對話共用一份存檔。黑貓負責陪 Clawd：平常在旁邊睡覺，Claude 叫出子代理時醒來陪著工作，子代理完成時撲上去。

A little pixel world above the Claude Code prompt. Every tool call brings a monster; when the call succeeds, Clawd the wizard casts a spell at it, and a refused call raises a honeycomb ward. Kills add XP and levels, shared by every session on the machine. A black cat keeps Clawd company and wakes up for subagents.

## 安裝 Install

需要 Claude 桌面 App 的 Code 分頁。畫面是為桌面 App 設計的。

Made for the Code tab of the Claude desktop app.

```bash
git clone https://github.com/Nao9494/pixmage ~/.claude/skills/pixmage
```

開一個新對話，打 `/pixmage`。Open a new conversation and type `/pixmage`.

## 怎麼玩 How it works

**畫面**
- **Clawd 的帽子**：跟著模型換。Haiku 是布帽，Sonnet 是藍帽，Opus 是紫帽，Fable 是王冠。
- **Clawd 的魔杖**：跟著思考強度換，從低到最大共五種。
- **閒著的時候**：Clawd 會看書、逗貓、喝茶、打盹，黑貓也會跟著互動。
- **點畫面上的東西**：點 Clawd、黑貓或城堡，各有小反應。

**下方訊息欄**有三種模式，在設定頁切換：
- **待辦事項**（預設）：顯示 Claude 正在做的那一項，例如「正在寫測試（1/3）」。
- **書記官**：每回合結束時，用 Haiku 濃縮一句目前進度。這會用到一點點額度。
- **工作紀錄**：給另外裝了 work-log 的人用。

**最下面的狀態列**
- 等級和經驗值。
- 5 小時和 7 天的用量，以及重置時間。點重置時間可以換顯示格式。
- 透過 LiteLLM 使用的人，會改成顯示本月預算和今天的花費。點「MON」可以在百分比和實際金額之間切換。
- CTX：這個對話塞滿了幾成。
- 黑貓旁邊的數字：正在跑的子代理數量。
- 沙漏：點一下開始 25 分鐘的專注倒數，再點一下停止。時間到會響。

**設定頁**（右上角齒輪）
- 音樂和音效的音量，旁邊的喇叭鍵可以靜音。
- 選歌：左邊的鍵切換單曲循環或隨機播放，點歌名換下一首。
- 下方訊息欄的模式、5H 和 7D 的時間格式。
- 自動壓縮的門檻。
- 語言：中文、English、日本語。
- 顯示效果：省電、標準、流暢。

**指令**
- `/pixmage`、`/pixmage off`：打開或關掉畫面。
- `/pixmage sound on|off`：音效開關。
- `/pixmage clock 24|12|left`：5H 重置時間的格式。
- `/pixmage compact on|off`：對話塞到 80% 時自動壓縮。預設關閉，只用 CTX 條提醒。

## 自己的音樂 Your own music

把 MP3 放進 `music/` 資料夾就會播。想要短一點的歌名，可以寫在 `music/titles.json`。

Put MP3 files in `music/`; short names go in `music/titles.json`.

## 授權與來源 Licences and credits

- **程式碼**：MIT（`LICENSE`）。Code: MIT.
- **字型**：Fusion Pixel Font，SIL OFL 1.1（`fonts/`）。Font: Fusion Pixel Font, SIL OFL 1.1.
- **音效**：自行合成，加上 Juhani Junkala 的 CC0 音效（`sounds/CREDITS.txt`）。Sound effects: synthesized, plus CC0 effects by Juhani Junkala.
- **音樂**：Holizna 的 6 首曲子，CC0（`music/CREDITS.txt`）。Music: six CC0 tracks by Holizna.
- **Clawd**：Anthropic 的角色，見最上方的聲明。Clawd is Anthropic's character; see the note at the top.
