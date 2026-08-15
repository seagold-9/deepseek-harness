# dsh 项目规格

[English](README.md) | 中文

本目录保存这个个人发行版的产品规格、架构决策和维护流程，与 DeepSeek Harness 官方的 `docs/` 分开管理。

当前项目基于 DeepSeek Harness 官方仓库，工作分支为 `ui-experiment`，基线提交为 `47f943859bef60e4160492346772ded9b24f765a`（2026-08-13）。当前远程 `origin` 仍指向官方仓库；建立个人 GitHub fork 后，应按[上游更新流程](upstream-update.md)调整远程命名。

## 文档索引

- [产品规格](product.md)：产品定位、目标用户、范围和验收标准。
- [桌面客户端架构](desktop-architecture.md)：进程、数据、安全、打包和迁移设计。
- [现有定制记录](customizations.md)：已经实现的 UI 与交互改动。
- [路线图](roadmap.md)：从当前 Web 实验到可分发桌面客户端的阶段计划。
- [上游更新流程](upstream-update.md)：跟进官方版本、处理冲突和发布验证的方法。
- [ADR-0001：采用 Electron](decisions/0001-electron-runtime.md)：桌面运行时选择及理由。

## 状态约定

- `已实现`：代码已经存在于当前工作区，并通过相应验证。
- `计划中`：已经确认方向，但尚未进入实现。
- `待决定`：需要原型、测试或用户选择后才能确定。
- `暂不做`：不属于当前阶段，不能作为已承诺功能。

## 维护规则

1. 产品边界只在[产品规格](product.md)中定义，其他文档引用它，不重复创造需求。
2. 架构变化先新增或替代 ADR，再修改实现；旧 ADR 保留并标记为已替代，不删除历史。
3. 每次完成用户可见的定制后，更新[现有定制记录](customizations.md)中的状态和验证证据。
4. 每次合并官方更新时，按[上游更新流程](upstream-update.md)记录基线、冲突和测试结果。
5. API Key、真实用户目录、会话内容和本机路径不得写入 Git。
6. `spec/` 属于本项目，不作为提交给官方上游的产品文档。

## 当前事实

- 源码目录：`D:\repos\deepseek-harness`
- 当前分支：`ui-experiment`
- 当前开发入口：`http://127.0.0.1:3081/?ui-experiment=1`
- 官方仓库：`https://github.com/deepseek-ai/deepseek-harness.git`
- 当前阶段：Web UI 定制已实现，桌面客户端处于规格设计阶段。
