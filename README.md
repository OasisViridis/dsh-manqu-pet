# dsh-manqu-pet

**满区 Manqu** —— 灰泽满（Hazel Man）的 CodexPet 粉丝宠物，原版移植到 DSH：**Web GUI 与桌面端共用同一套客户端插件**，桌面端额外避开原生窗口按钮。

![manqu](.dsh-plugin/assets/favicon.png)

## 这是什么

把 Codex 桌面客户端里的宠物格式（**CodexPet v2**：`pet.json` + 单张 spritesheet 图集，192×208 单元格 × 8 列 × 11 行）完整搬进 DSH：**待机眨眼、拖动时一拱一拱地蠕动、鼠标靠近时视线跟随（16 方向）**，并接入 DSH 会话/任务情绪：

| 你做什么 / 发生什么 | 满区的表现 |
|---|---|
| 常态 | 待机（`idle`，随机眨眼） |
| 任一会话思考 / 任务运行中 | 工作（`running`） |
| 等待批准 | 期待等待（`waiting`） |
| 回合 / 任务完成 | 跳跃庆祝（`jumping`），庆祝后如有未读活动则检查环视（`review`，10 分钟内；单击已读回待机），气泡显示结果摘要 |
| 任务失败 | 失落（`failed`） |
| 鼠标靠近（仅待机时） | 视线跟随（`look-a`/`look-b`，16 方向） |
| 点击 / 右键菜单打招呼 | 挥手（`waving`） |
| 双击 / 菜单跳一下 | 跳跃（`jumping`） |
| 拖拽 | 一拱一拱地蠕动（`running-left`/`running-right` 快放） |
| 空闲 | 随机散步（左右蠕动横移） |
| 右键菜单 | 活动托盘（各会话/任务实时状态：等待批准=橙点，运行=蓝点）+ 打招呼/跳一下/隐藏 |

桌面端（DSH Desktop）额外行为：宠物被钳制在窗口内并避开原生窗口按钮区（Windows 顶部 40px 标题栏按钮、macOS 红绿灯，全屏时安全区自动收起）；拖到窗口顶部不会钻到按钮底下，关掉再开也会把记住的旧坐标拉回可视区；窗口最小化/隐藏时暂停状态轮询。

## 安装

官方 **bundle 插件** 格式（`dsh.bundle` + `dsh.client`），经 profile 管理：装进哪个 profile，就在哪个宿主里生效（桌面端 = `desktop` profile，独立 Web = `web` profile）。

### DSH 桌面端

侧边栏 **插件** → **添加插件**，填 GitHub 地址或本地路径，装完 **立即启用** 并重启应用（bundle 层在启动时合成）：

```text
github:OasisViridis/dsh-manqu-pet
```

本地开发用仓库绝对路径（插件页同样接受本地路径）：

```text
D:\Project\GitProject\dsh-manqu-pet
```

### Web GUI（dsh CLI）

```sh
# 方式一：GitHub 安装
dsh plugin --profile web add "github:OasisViridis/dsh-manqu-pet"

# 方式二：本地开发安装
dsh plugin --profile web add "<仓库绝对路径>"
```

装完**重启宿主**（bundle 层在启动时合成），窗口左下角出现满区：点击打招呼、双击跳跃、拖拽移动（拖动时蠕动）、鼠标靠近视线跟随、右键菜单（打招呼/跳一下/隐藏）。位置与隐藏状态保存在 localStorage（`dsh-manqu-pet:*`）。

## 桌面端适配

DSH 桌面端（Electron 外壳）加载的就是这套 Web GUI：客户端插件、`__DSH_BOOT__`、路由与 SSE 全部一致，`dsh.client.platform` 仍是 `web`，因此**同一份 bundle 同时支持 Web 与桌面端**，不需要第二个客户端产物。差异只在外层窗口壳，插件按桌面外壳写在 `<html>` 上的标记自适应：

| 壳层事实 | 来源标记 | 插件行为 |
|---|---|---|
| Windows 标题栏按钮（`titleBarOverlay`，高 40px） | `data-windows-titlebar` + `--dsh-windows-titlebar-height` | 可拖拽区域钳制在该高度以下，宠物不会被最小化/最大化/关闭按钮盖住，也不会抢走窗口拖动 |
| macOS 红绿灯 | `data-platform="darwin"` | 顶部 48px 安全区内不放宠物 |
| 全屏（原生控件收起） | `data-fullscreen` | 安全区降到 20px，位置重新钳制 |
| 窗口尺寸变化 / 最大化 | `resize` | x、y 一起重钳，记住的旧坐标不会留在窗口外 |
| 最小化 / 隐藏 | `document.visibilityState` | 暂停 `/manqu/state` 轮询，恢复时立刻补一次 |
| 窗口较矮 | —— | 贴底时状态条与右键菜单改开在宠物上方，贴顶时气泡改放宠物下方 |

`-webkit-app-region: no-drag` 显式写在宠物与恢复按钮上：点宠物、拖宠物、右键菜单都不会被解释成拖动窗口。

## 开发

```sh
npm i -D esbuild   # 首次
node scripts/build-client.mjs        # 生成 .dsh-plugin/client.js
node scripts/build-client.mjs --check  # 校验生成物新鲜（手改生成物禁止）
node --test tests/*.test.mjs          # 纯逻辑单测
```

- 改客户端逻辑 → 改 `.dsh-plugin/client/index.mjs` / `atlas.mjs`，重新 build。
- 路由前缀单一来源：`.dsh-plugin/src/routes.mjs`。
- 桌面端窗口几何（安全区/位置钳制）是纯函数：`.dsh-plugin/src/shell.mjs`，单测在 `tests/shell.test.mjs`。
- 素材契约：`pet.json`（CodexPet manifest）+ `spritesheet.webp`（1536×2288，v2 图集）。

## 结构

```
.dsh-plugin/
  index.mjs          # Node half：/manqu/state 情绪聚合 + /manqu/assets + /manqu/events(SSE)
  client.js          # client bundle（esbuild 产物，勿手改）
  client/
    index.mjs        # 浏览器 half：图集播放器 + 交互
    atlas.mjs        # CodexPet v2 图集纯逻辑（状态表/帧检测/方向）
  src/
    routes.mjs       # 路由前缀单一来源
    state.mjs        # 情绪 → 基础状态纯函数（5 态；look/挥手/蠕动/散步由 client 本地覆盖）
    shell.mjs        # 宿主窗口壳层（Web / 桌面端）安全区 + 位置钳制纯函数
    session-events.mjs  # turn 边沿解析
    assets.mjs       # assets 路径净化 + MIME
  assets/
    pet.json         # CodexPet manifest（满区）
    spritesheet.webp # v2 图集（1536×2288）
cordis.patch.yml     # bundle 挂载补丁
```

## 致谢

- 角色：**灰泽满**（Bilibili UP 主）的粉丝宠物 **Manqu**（满区）
- 格式：CodexPet v2（OpenAI Codex 桌面宠物格式）
- DSH bundle 插件范本：[vlln/whale-girl](https://github.com/vlln/whale-girl)

Manqu 相关图像与 manifest 素材的来源记录见 [`ASSET-NOTICE.md`](./ASSET-NOTICE.md)。
本仓库的 atlas 播放逻辑是独立实现，不把 PetViewer 的具体代码作为本项目代码来源。

## License

- **源代码**：MIT（见 [`LICENSE`](./LICENSE)）。该许可仅适用于本项目自行编写的源代码。
- **Manqu 素材**：第三方/粉丝向素材，不自动包含在 MIT 许可中；请先阅读
  [`ASSET-NOTICE.md`](./ASSET-NOTICE.md)。
- 本项目与灰泽满、相关创作者或 OpenAI 不构成官方关联、授权背书或赞助关系。
