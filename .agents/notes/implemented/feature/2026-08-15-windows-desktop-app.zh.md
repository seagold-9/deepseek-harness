# Agent Note: 基于官方 Web profile 的 Windows 桌面客户端

Status: implemented

[English](2026-08-15-windows-desktop-app.md) | 中文

## 问题

使用 DSH Web profile 时，用户需要启动命令、保留终端、找到浏览器标签页，并把该标签页与其他浏览器工作区分开。可分发的桌面应用必须保留官方 Web 行为和用户数据，同时提供独立的任务栏应用、常规快捷方式、单实例行为，并且不要求目标电脑安装 Node.js 或 pnpm。

Electron 不能同时充当后端运行时。Electron 43 内置 Node.js 24，但其可执行文件和模块环境加载 vendored Cordis ESM 依赖图的方式与受支持的标准 Node.js 运行时不同。桌面包还需要闭合生产依赖集合：由 workspace 根目录提供的 pnpm 对等依赖在隔离部署后并不存在。

## 决策

[`apps/desktop`](../../../../apps/desktop/README.md) 是基于官方构建产物 `dsh web` 入口的 Windows x64 Electron shell。Electron 只负责窗口、导航策略、单实例锁和后端生命周期。内置的标准 Node.js `v24.14.0` 可执行文件使用端口 `0` 在 `127.0.0.1` 上运行后端；shell 读取后端输出的 URL 并加载该 origin。桌面应用不会 fork Web 组合，也不会引入 IPC 客户端实现。

shell 在每次启动后端时都会把 `DSH_HOME` 设置为用户常规的 `~/.dsh` 目录。因此，安装版和 Portable 包可以共用官方 DSH 的 profile、会话、设置和凭据引用，而不会把持久数据保存在应用安装目录中。

渲染器启用 Chromium 沙箱和上下文隔离，并禁用 Node.js 集成。它没有 preload bridge。导航仅限于本次启动对应的后端 origin；外部 HTTP 链接通过系统浏览器打开；权限、下载、新的嵌入式窗口和 webview 均被拒绝。

关闭最后一个窗口会触发应用退出。退出过程会等待后端正常释放资源；超过限定期限后，再终止应用拥有的 Windows 进程树。启动诊断只保留长度受限的输出尾部，在显示前对常见凭据格式进行脱敏，并提供不向渲染器开放宿主访问权限的重试操作。

## 运行时分发

[`apps/desktop-runtime/package.json`](../../../../apps/desktop-runtime/package.json) 是桌面后端的零代码部署根目录。它声明 `@deepseek-ai/dsh`，以及发布依赖图要求宿主提供的所有必需非可选对等依赖。运行时准备过程使用注入 workspace 包的隔离 pnpm 部署和 hoisted 布局；任何无法从暂存运行时内部解析的必需对等依赖都会导致构建失败；文件系统链接也会被拒绝；该过程还会嵌入构建宿主中版本完全一致的 `node.exe`。

Electron Builder 通过两个独立的显式资源集合接收 `node.exe` 和 `node_modules`。这种拆分可防止其应用依赖过滤逻辑丢弃嵌套运行时。NSIS 安装包和 Portable 可执行文件包含相同的后端内容；目标电脑不需要 Node.js 或 pnpm。这种闭合 manifest 的方式与[单文件 SDK 运行时分发](../architecture/2026-07-10-single-file-executable-sdk-runtime-distribution.md)相关，但不会取代该决策。

## 验证

后端启动器通过聚焦测试覆盖分片就绪输出、URL 验证和诊断信息脱敏。包构建执行严格 TypeScript 编译和运行时冒烟测试；该测试会启动暂存的 `node.exe`，等待动态分配的 URL，要求 HTTP 响应状态为 200，然后停止该进程。

发布验证从打包后的路径启动解包应用，观察内置 Node 进程拥有的单个回环监听端口，加载真实 Web 页面，启动第二个实例并确认只有一个主进程和一个后端，关闭窗口，然后确认应用拥有的进程全部退出。安装包验证还要求注册卸载元数据，并创建桌面和开始菜单快捷方式。

## 考虑过的替代方案

**继续只用浏览器承载 UI。** 否决原因：浏览器标签页无法提供所需的任务栏身份、快捷方式启动、单实例所有权和应用专属窗口策略。

**使用 `ELECTRON_RUN_AS_NODE` 通过 Electron 可执行文件运行后端。** 否决原因：内置运行时无法加载真实的 vendored loader 依赖图。Node 主版本相同，并不代表 Electron 模块环境可以与受支持的运行时互换。

**构建桌面客户端专用前端或 IPC carrier。** 否决原因：在没有桌面专属能力需求的情况下，这会复制官方 Web 客户端并增加更新漂移。现有回环 carrier 已能保留完整产品行为。

**要求目标电脑安装 Node.js 和 `dsh` 命令。** 否决原因：安装状态、版本和对等依赖解析会因电脑而异，无法作为一个经过验证的应用直接传输。

**只发布 Portable 可执行文件。** 不将其作为主要路径，因为自解压包每次启动都会展开完整的 Electron 和 DSH 文件树。安装版只承担一次该成本，并提供常规的长期应用体验。

## 后果

桌面应用在包和前端构建层面跟随 Web profile 更新：重新构建闭合运行时和 Electron 资源即可包含更新后的官方组合，无需重新实现。用户 profile、会话、设置和凭据引用仍保存在常规 DSH home 中，并在应用升级或替换后继续保留。

该分发只支持 Windows x64，固定使用一个标准 Node.js 构建版本，并且没有代码签名。解包后的应用体积较大，包含数万个依赖文件。Windows 安全扫描可能使安装过程较慢，而 Portable 可执行文件会在每次启动时重复该解压成本；安装版快捷方式是支持的日常使用入口。未来的归档和缓存设计可以降低文件数量带来的开销，但必须保留本文记录的运行时闭包检查、原子发布、版本隔离、清理和后端关闭行为。
