# 11 — VS Code / Cursor 扩展与 LSP

本文档说明 **两条独立产品线** 的布局、安装方式、功能与本地开发/发版流程。

> **分发说明**：扩展**不上架** VS Code Marketplace，仅供团队/私有场景通过 **`.vsix` 手动安装**或 GitHub Release 获取。

## 1. 两条产品线

| 产品线 | 位置 | 版本号 | 发布渠道 | CI/CD |
|--------|------|--------|----------|-------|
| **解析器库** | 仓库根目录 `src/` | 根 `package.json` | **npm** `@agile-sofl/parser` | `ci.yml` + `publish.yml` |
| **编辑器栈** | `packages/language-server` + `packages/vscode` | `packages/vscode/package.json` | **私有 `.vsix`**（GitHub Release / 本地打包） | `ci-editor.yml` + `package-extension.yml` |

- Parser 发版**不触发**扩展发版；扩展发版**不触发** parser npm 发版。
- 扩展运行时 bundled 的 Language Server 依赖 `@agile-sofl/parser`（CI 打包时使用 workspace 构建；本地可用 `file:../..` 联调）。
- Language Server **不单独发 npm**：esbuild 打包进 `packages/vscode/server/server.js`，随 `.vsix` 分发。

## 2. 安装（用户）

扩展仅通过 **VSIX** 安装，适用于 VS Code 与 Cursor。

### 方式 A：GitHub Release

1. 打开仓库 [Releases](https://github.com/agile-sofl/agile-sofl-parser/releases)，找到标签 `extension-vX.Y.Z`。
2. 下载附件 `agile-sofl-X.Y.Z.vsix`。
3. VS Code / Cursor：**扩展** → **…** → **Install from VSIX…**（从 VSIX 安装），选择下载的文件。
4. 打开任意 `.asfl` 文件即可。

### 方式 B：本地打包

维护者或开发者自行打包（见 [5.4 本地打 VSIX](#54-本地打-vsix)），将 `.vsix` 通过网盘、内网共享等方式分发给成员，同样使用 **Install from VSIX…** 安装。

### 方式 C：F5 开发宿主（仅开发）

仓库根目录按 **F5** 启动 Extension Development Host，无需安装 VSIX。见 [5.2 F5 调试](#52-f5-调试)。

## 3. 功能（第一期）

| 能力 | 说明 |
|------|------|
| 语法高亮 | TextMate grammar：`syntaxes/agile-sofl.tmLanguage.json` |
| 实时诊断 | LSP `publishDiagnostics`，默认 debounce 300ms，调用 `check()` |
| 格式化 | **Format Document**，4 空格语义缩进（块关键字顶格、内容递增缩进；FSF 每场景一行） |
| 大纲 | **Outline**，`documentSymbol`（模块 / 类型 / 变量 / 进程 / 函数） |
| 语言配置 | 块注释 `/* */`、括号配对、`indentationRules` 输入缩进 |

扩展设置：

- `agileSofl.trace.server` — LSP 跟踪级别
- `agileSofl.debounceMs` — 诊断 debounce 毫秒数

### 3.1 格式化与缩进规则

**Format Document**（`Shift+Alt+F`）通过 parser AST pretty-printer 输出，规则如下：

| 层级 | 顶格（0 空格，相对模块） | 缩进 +4 空格 |
|------|--------------------------|--------------|
| 模块 | `module …;`、`const`/`type`/`var`/`inv`、`process`/`function` 签名、`end_*` | 段内条目 |
| 类型 composed | `Name = composed of` | 各字段；`end;` 与 `composed of` 同层 |
| 进程体 | — | `ext`、`rd`/`wr`、`FSF :`、各场景、`decom`、`comment` |
| FSF | `FSF :` | 每个 `test && def` 场景单独一行，行间以 `\|\|` 连接 |

示例：

```asfl
process AddToCart (customer: CustomerId, product: ProductId) ok: nat
    ext
    rd inventory: Inventory
    FSF :
    customer > 0 && ok = 1 ||
    others && ok = 0
end_process
```

手动编辑时，`language-configuration.json` 中的 `indentationRules` / `onEnterRules` 会在 Enter 时尽量与上述层级一致。

## 4. 示例规格

仓库 `examples/` 下三个大型 demo，可用于打开验证：

| 文件 | 特性 |
|------|------|
| `library-system.asfl` | 多模块、composed、inv 量词、FSF + others |
| `ecommerce.asfl` | map/product/union、ext、process alias、decom |
| `hospital-registration.asfl` | enum、function、多子模块 FSF |

集成测试：`tests/integration/demo-fixtures.test.ts`。

## 5. 本地开发

### 5.1 依赖与构建

```bash
# 仓库根目录
npm install
npm run build

# Language Server
npm run build --prefix packages/language-server
npm test --prefix packages/language-server

# 打包 server 并编译扩展
node packages/language-server/scripts/bundle.mjs
npm run build --prefix packages/vscode
```

### 5.2 F5 调试

以**仓库根目录**为 VS Code 工作区，按 **F5**（配置见 `.vscode/launch.json`），会启动 Extension Development Host 并打开 `examples/library-system.asfl`。

### 5.3 联调本地 parser

根目录 `npm run build` 后，`packages/language-server` 通过 `"@agile-sofl/parser": "file:../.."` 引用本地构建产物。修改 parser 后重新 build + bundle server 即可。

### 5.4 本地打 VSIX

```bash
npm run build
npm run build --prefix packages/language-server
node packages/language-server/scripts/bundle.mjs
npm run package --prefix packages/vscode
# 产物：packages/vscode/agile-sofl-0.x.x.vsix
```

将生成的 `.vsix` 分发给团队成员，或使用 [6.2](#62-扩展--vsix-私有分发) 中的 CI 上传至 GitHub Release。

## 6. 发版（维护者）

### 6.1 Parser → npm

- 工作流：`.github/workflows/publish.yml`
- 触发：`release: published`（标签 `vX.Y.Z`）或 `workflow_dispatch`
- Secret：`NPM_TOKEN`
- **仅** bump 根 `package.json`，不包含扩展

### 6.2 扩展 → VSIX 私有分发

- 工作流：`.github/workflows/package-extension.yml`（**不**发布 Marketplace）
- 触发：`workflow_dispatch`（patch/minor/major）或 push 标签 `extension-vX.Y.Z`
- 步骤：bump `packages/vscode/package.json` → build/bundle → `vsce package` → 上传 `.vsix` 到 GitHub Release
- **无需** `VSCE_PAT` 等 Marketplace 凭据

### 6.3 CI

| 工作流 | 范围 |
|--------|------|
| `ci.yml` | parser：`src/`、`tests/` |
| `ci-editor.yml` | `packages/**`、`examples/**`：LSP 测试 + `vsce package` 编译检查 |

## 7. Monaco / 其他编辑器

Language Server 入口：`packages/language-server/src/server.ts`（stdio）。Monaco 或其他 Web 编辑器可：

1. 从扩展 `.vsix` 或源码 bundle 引用 `server/server.js`；或
2. 直接依赖 `@agile-sofl/parser` 在浏览器侧调用 `check()` / `format()`（无 LSP）。

详见 [10-编辑器路线图.md](./10-编辑器路线图.md) 中长期能力规划。

## 8. 版本策略示例

- Parser：`0.1.0` → npm + git tag `v0.1.0`
- Extension：`0.1.0` → git tag `extension-v0.1.0` + Release 附件 `.vsix`
- 二者版本号**互不绑定**，按各自变更独立 bump
