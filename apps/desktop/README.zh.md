# dsh 桌面客户端

[English](README.md) | 中文

桌面客户端在受限的 Electron 窗口中运行官方 DSH Web profile。客户端内置标准 Node.js 运行时，使用操作系统分配的回环端口启动 DSH，并在应用退出时停止后端。[桌面客户端 Agent Note](../../.agents/notes/implemented/feature/2026-08-15-windows-desktop-app.md)记录了分发和生命周期决策。

## 运行时布局

Electron 负责窗口和进程生命周期。内置的 `node.exe` 运行常规构建产物中的 `dsh web --host 127.0.0.1 --port 0` 入口，因此后端仍然采用官方 Web 组合，而不是桌面客户端专用 fork。[`../desktop-runtime/package.json`](../desktop-runtime/package.json) 中的桌面运行时 manifest 闭合了生产依赖集合，其中包括必需的对等依赖（peer dependency）。

shell 会显式使用指向常规用户目录（`~/.dsh`）的 `DSH_HOME` 启动后端。因此，用户 profile、会话、设置和凭据引用会在应用升级、替换以及安装版与 Portable 包之间切换时继续保留。Electron 浏览器状态单独保存在操作系统的应用数据目录中。客户端不会把 API Key 复制到安装目录或仓库中。

## 开发

启动桌面 shell 前，请先构建仓库：

```sh
pnpm run build
pnpm run desktop:dev
```

客户端会在动态端口上启动自己的后端，不会复用或停止单独启动的 `dsh web` 进程。

## Windows 包

Windows 构建要求使用 Node.js `v24.14.0` x64。使用其他 Node 版本或平台时，运行时准备步骤会失败。

```sh
pnpm run desktop:dist
```

该命令会编译 shell、生成鲸鱼图标、部署不含文件系统链接的纯生产运行时、启动该运行时并要求获得 HTTP 200 响应，随后在 `apps/desktop/release/` 下写入以下文件：

运行时验证使用独立的临时 Harness home、Agent 目录和工作目录，绝不会在构建用户常规的 `~/.dsh` 下初始化或修复 profile。

| 产物 | 用途 |
|---|---|
| `dsh-Setup-0.1.0-rc.5-x64.exe` | 推荐的安装版本，包含桌面和开始菜单快捷方式。 |
| `dsh-Portable-0.1.0-rc.5-x64.exe` | 用于临时使用或在电脑之间传输的自解压版本。 |

目标电脑不需要安装 Node.js 或 pnpm。安装版可以直接从 `dsh` 快捷方式启动。Portable 产物包含相同的运行时，但每次启动都会解压完整的 Electron 应用；Windows 安全扫描可能使其明显慢于安装版。

这些包没有代码签名，因此 Windows SmartScreen 可能在启动前发出警告。公开分发前还需要审查 DeepSeek 名称和 logo 的使用方式。

## 安全与失败行为

渲染器不启用 Node.js 集成，也没有 preload API；它启用上下文隔离和 Chromium 沙箱，并且只能在本次启动选定的后端 origin 内导航。外部 HTTP 链接通过系统浏览器打开。渲染器权限请求、下载和嵌入式 webview 均被拒绝。

shell 仅在内存中保留长度受限且经过脱敏的进程输出尾部，用于启动诊断。后端启动失败时，客户端会显示本地重试页。关闭窗口时，客户端会先请求 DSH 正常释放资源；如果关闭时间超过限定期限，再终止其拥有的进程树。
