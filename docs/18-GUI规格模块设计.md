# 18 — GUI 规格模块设计

本文档是 **GUI 规格模块**的权威设计，与 [17-Informal与Hybrid规格编辑器设计.md](./17-Informal与Hybrid规格编辑器设计.md)、[19-ASFL-GUI文法扩展.md](./19-ASFL-GUI文法扩展.md) 互补。权威语义来自 *Agile-SOFL: Agile Formal Engineering Method*（Springer, 2024）Ch.4 §4.2：GUI 不是形式规格本身，而是用户—开发者沟通媒介。

## 1. 目标与范围

| 术语 | 含义 |
|------|------|
| **GUI Specification** | 受限 HTML5 文档（`.gui.html`）：页面结构、`as-*` 布局/控件、`data-*` 绑定 |
| **Screen** | `data-screen` 节，一个 UI 页面 |
| **Prototype** | 同一 HTML 经 Shadow DOM + Studio 主题 token 渲染的高保真原型 |
| **Scenario animation** | 填表 → `data-process` → 小求值/选 FSF 场景 → 写回 `out:` / `var:` |

**范围**

- `@agile-sofl/gui`：受限 HTML parse / sanitize / validate / patch / inventory / 场景求值 / 主题 stylesheet
- Studio：DOM 树 + class/`data-*` 检查器 + 主题化原型 + 同屏规格动画；Code Tab 编辑 `.gui.html`
- Informal `meta.guiTarget` 指向外部 `.gui.html`
- YAML `.guispec` 仅作一次性迁移源，不再是权威正文

**不在范围**：完整 SOFL 谓词解释器、把规格译成 JS、spec 内 `<script>` / 自定义 CSS / 绝对定位。

## 2. 文件格式

### 2.1 独立 `.gui.html`

一份文档、多屏。只允许白名单标签与 `as-*` class。示意：

```html
<div class="as-app" data-app="Trading">
  <section class="as-screen" data-screen="Login">
    <div class="as-stack as-gap-md">
      <label class="as-field">
        用户名
        <input class="as-input" data-bind="param:user_id" />
      </label>
      <button class="as-btn as-btn-primary" data-process="Auth.Login" data-nav="Dashboard">登录</button>
    </div>
  </section>
  <section class="as-screen is-hidden" data-screen="Dashboard">…</section>
</div>
```

约定属性：

| 属性 | 含义 |
|------|------|
| `data-screen` | 屏 id |
| `data-process="Module.Proc"` | 触发的 Hybrid process |
| `data-bind="param:x \| var:accounts \| out:ok"` | 入参 / 模块状态 / 出参 |
| `data-nav="Screen"` | 无脚本屏间导航 |
| `data-scenario` | 可选，动画时锁定 FSF 场景 |

class 设计系统（`as-*`，映射 Studio CSS variables，随 `.dark` 切换）：布局 `as-row|as-col|as-grid|as-stack|as-card`；控件 `as-btn|as-input|as-select|as-table|as-list|as-navbar|as-field|as-title|as-muted`。

禁止：`<script>`、`on*`、`<iframe>`、`<style>`、inline `style`、任意 class。解析用白名单消毒；原型在 Shadow DOM 中渲染，spec HTML 永不 `eval`。

### 2.2 Informal 链接

`informal-meta.json` 的 `guiTarget` 指向 `./gui.html`。`.aspec` 内嵌 YAML `gui:` 仅在迁移时读取。

### 2.3 旧 YAML

`parseGuiSpec` 若检测到 `guispecVersion` / `gui:` YAML，则扁平 widgets → `as-stack` 骨架并丢弃 `bounds`。

## 3. 诊断码

| 码 | 条件 |
|----|------|
| `GUI_PARSE_001` | HTML 为空或 YAML 无法迁移 |
| `GUI_SCHEMA_001` | 缺 `data-app` 等结构错误 |
| `GUI_STYLE_001` | screen 无内容 |
| `GUI_STYLE_002` | `data-process` 在 Hybrid/Informal 中不存在 |
| `GUI_STYLE_003` | `data-nav` 引用未知 screen |
| `GUI_STYLE_004` | 重复 id |
| `GUI_HTML_001` | 禁止标记（已消毒） |
| `GUI_HTML_002` | 未知 class（已剥离） |
| `GUI_HTML_003` | `data-bind` 名不对照 process 签名 / `var` |

跨文件 check：`buildGuiModel(..., { hybridProcesses })` 用 Hybrid 签名校验 `data-process` 与 `data-bind`。

## 4. IPC（Studio）

| Channel | 说明 |
|---------|------|
| `studio:build-gui-model` | HTML → GuiDocumentModel（可带 informal / hybrid 交叉校验） |
| `studio:patch-gui` | 树补丁：`add-screen` / `insert-html` / `patch-node` / `replace-html` 等 |
| `studio:format-gui` | 消毒后 pretty-print |
| `studio:animate-gui-process` | `deriveFsf` + 小求值 / 选场景，返回 mock 输出 |
| `studio:resolve-gui-for-aspec` | Informal 内嵌 + 外部 HTML 合并（外部优先） |

## 5. 原型与主题

`prototypeStylesheet` 把 `--gui-*` / `--surface-*` / `--accent` 注入 Shadow DOM。预览跟随 Studio 深浅色，不以强制浅色线框为默认。

## 6. 规格动画

Run 模式：读 `data-bind` 填 process 输入 → `deriveFsf` 列出场景 → 对字面量/标识符级条件求值（`x > 0`、`ok = true`）→ 失败则人选场景 → 把输出 mock 写回 `out:` / `var:`。半形式 FSF 一律走「选场景 + mock 输出」。不是完整解释器，也不译成 JS。

## 7. Trace / Coverage

- Trace link kind：`gui-screen` | `gui-widget`
- Screen covered：当 `data-process` / `triggersProcess` 对应 process 在 hybrid 中 covered
- Hybrid `.asfl` 只保留 slim `screen Name triggers Mod.Proc;` 追踪，权威结构在 HTML
