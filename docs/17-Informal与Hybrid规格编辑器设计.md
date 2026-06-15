# 17 — Informal 与 Hybrid 规格编辑器设计

本文档是 **Task 1**（Informal + Hybrid 规格编辑器）的权威设计规格，与 [15-Studio可视化编辑器.md](./15-Studio可视化编辑器设计.md)、[12-Electron编辑器集成.md](./12-Electron编辑器集成.md) 互补。Task 2（需求缺陷预防研究方法）不在范围内。

## 1. 目标、范围与术语

| 术语 | 含义 |
|------|------|
| **Informal Specification** | 遵循 *Agile-SOFL: Agile Formal Engineering Method*（Springer, 2024）编写风格的非形式规格，存于 `.aspec` 文件 |
| **Hybrid Specification** | 符合 Agile-SOFL 文法的混合形式规格，存于 `.asfl` 文件 |
| **Refinement（精化）** | 从 Informal Spec 生成或更新 Hybrid Spec 骨架，并建立 traceability |
| **Traceability** | Informal 条目（`id`）与 Hybrid AST 节点之间的双向链接 |
| **Coverage** | Informal 条目在 Hybrid 中被实现/覆盖的程度 |

**范围**

- 新建 `@agile-sofl/aspec` 包：解析、style 校验、精化、trace、coverage
- Studio 双文档类型（`.aspec` / `.asfl`）、精化向导、项目工作区
- Hybrid 编辑器补齐：区域装饰、informal 谓词创建、`patchInformal`、informal 清单面板

## 2. 与著作 style 的对齐（BOOK_ALIGN）

权威来源：*Agile-SOFL: Agile Formal Engineering Method*（Springer, 2024），见 [docs/Aigle-SOFL.pdf](./Aigle-SOFL.pdf)。

### 2.1 著作 Informal 章节结构（Ch.3）

Informal Specification 由三节组成（Market-Driven Approach）：

| 节 | 著作标题 | `.aspec` 映射 | 必填 |
|----|----------|---------------|------|
| **I. Functions** | 期望功能/服务列表 | `modules[].processes[]` + 可选 `bookAlign.functions[]` | 至少一项功能 |
| **II. Data** | 跨功能共享数据 | `modules[].variables/types` + `bookAlign.data[]` | 推荐 |
| **III. Constraints** | 功能/数据约束 | `modules[].invariants` + `bookAlign.constraints[]` | 推荐 |

著作写法要点：

- 功能编号 `F_1`, `F_2`…；数据 `D_1`…；约束 `C_1`…
- Data/Constraints 用括号标注关联：如 `Customer list (F_1, F_3, F_4)`、`(F_3, D_2)`
- **完整性**：覆盖全部期望功能、共享数据与重要约束（Ch.3 §3.3）
- **对称功能**：Borrow/Return、Register/Cancel 等互补服务（Ch.5 §5.1.1）
- 复杂功能可用层级编号分解

`bookAlign` 可选块保留著作三节字面结构，与 `modules` 并行，供校验与 diff：

```yaml
bookAlign:
  functions:
    - ref: F_1
      description: Register customer (name, age, …)
  data:
    - ref: D_1
      description: Customer list
      usedBy: [F_1, F_3, F_4]
  constraints:
    - ref: C_1
      description: At most 1000 units per stock kind
      refs: [F_3, D_2]
```

### 2.2 BOOK_ALIGN 诊断规则

| 码 | 严重度 | 条件 |
|----|--------|------|
| `BOOK_ALIGN_001` | warning/error | 无任何过程（Functions 为空） |
| `BOOK_ALIGN_002` | info | Data 项缺少 `usedBy` 引用 |
| `BOOK_ALIGN_003` | info | Constraint 缺少 `refs` 引用 |
| `BOOK_ALIGN_004` | warning | strict 模式下缺少 constraints 节 |
| `BOOK_ALIGN_005` | info | 可能存在缺失的对称功能（如 Borrow 无 Return） |
| `BOOK_ALIGN_006` | info | 多过程但无共享 data 描述 |
| `BOOK_ALIGN_007–009` | warning | bookAlign 条目格式不完整 |

CLI：`aspec validate --book-align-strict` 将部分 warning 升为 error。

### 2.3 Informal → Hybrid 语义映射（Ch.4–5）

| Informal | Hybrid | 精化策略 |
|----------|--------|----------|
| Functions / processes | `process` + FSF | 场景 → FSF 分支 |
| Data types/vars | `type` / `var` | typeHint 形式化 |
| Constraints | `inv` / FSF test | textHint → inv 谓词 |
| pre/postconditions | FSF test/def 或 comment | 写入 comment 或 FSF |
| `bottomLevel: false` | 半形式 FSF + `decom` | Test 含 `informal` 原子 |
| `bottomLevel: true` | 形式 FSF | Test 为可解析谓词 |
| function bodyHint | `function … == …` | 占位或 semi-formal FSF |

### 2.4 Hybrid FSF 分层规则（Ch.4）

| 层次 | 条件 | FSF 要求 | Studio 约束 |
|------|------|----------|-------------|
| 非底层过程 | 有 `decom` | **半形式** FSF + 可选 `comment` | 允许 informal 原子；Badge semi-formal |
| 底层过程 | 无 `decom` | **形式** FSF | 禁止 informal 原子（strict 模式） |
| 函数 | — | 半形式或形式 | `==` 体或 FSF |
| GUI 模块 | 可选 | 更非形式的页面/控件描述 | 未来 `gui` 模块扩展 |

Trace 注释标记：精化时在 `comment:` 写入 `aspec_{id}`（ASFL 词法兼容，非 `@aspec-id`）。

## 3. `.aspec` 文件格式

### 3.1 约定

- 扩展名：`.aspec`
- 编码：UTF-8
- 格式：YAML 文档（Markdown 字段用 `|` 或 `>` 块标量）
- 版本：`aspecVersion: "1.0"`
- Sidecar trace：`同名.aspec.trace.json`（精化后生成）

### 3.2 顶层结构

```yaml
aspecVersion: "1.0"
meta:
  id: "550e8400-e29b-41d4-a716-446655440000"
  title: "Library System"
  author: "Team"
  revision: "1"
  hybridTarget: "./library-system.asfl"

system:
  name: "Library"
  purpose: |
    Manage books, members, and loans.
  scope: |
    In-library circulation only.
  stakeholders: [Librarian, Member]
  assumptions: |
    Member ids are unique.
  glossary:
    - term: Loan
      definition: Temporary book assignment to a member.

modules:
  - id: mod-library
    name: SYSTEM_Library
    description: |
      Top-level library system.
    types:
      - id: type-book-id
        name: BookId
        typeHint: nat
        description: Unique book identifier.
    variables:
      - id: var-books
        name: book_ids
        typeHint: "set of nat"
        description: Registered books.
    invariants:
      - id: inv-books
        description: All book ids are positive.
        textHint: "forall[b: book_ids] | b > 0"
    processes:
      - id: proc-borrow
        name: Borrow
        description: |
          Member borrows a book when both ids are valid.
        signature:
          inputs:
            - name: member_id
              typeHint: nat
          outputs:
            - name: success
              typeHint: nat
        scenarios:
          - id: scen-valid
            condition: member and book ids are valid
            outcome: success is 1
          - id: scen-invalid
            condition: book id is zero
            outcome: success is 0
        decomposition: Library_Borrow
        notes: |
          See circulation submodule for details.
        refinementHints:
          expectedFsfLevel: semi-formal
          bottomLevel: false
    functions:
      - id: fn-member
        name: member_registered
        description: Check member registration.
        signature:
          inputs: [{ name: id, typeHint: nat }]
          outputs: [{ name: result, typeHint: nat }]
```

### 3.3 JSON Schema

权威 schema：`packages/aspec/schema/aspec-v1.schema.json`  
Trace schema：`packages/aspec/schema/trace-v1.schema.json`

### 3.4 字段类型

| 类型 | 说明 |
|------|------|
| `markdown` | 非空字符串（多行自然语言） |
| `typeHint` | 映射到 ASFL 类型的提示；精化失败时回退 `nat` |
| `refinementHints.bottomLevel` | `true` → 精化时形式 FSF；`false` → 半形式 FSF + `decom` |

## 4. Style 校验与诊断码

| 码 | 严重度 | 条件 |
|----|--------|------|
| `ASPEC_PARSE_001` | error | YAML 语法错误 |
| `ASPEC_SCHEMA_001` | error | 不符合 JSON Schema |
| `ASPEC_STYLE_001` | error | 缺少或空的 `system.purpose` |
| `ASPEC_STYLE_002` | error | 模块缺少 `description` |
| `ASPEC_STYLE_003` | warning | 过程无 `scenarios` 且无 `description` |
| `ASPEC_STYLE_004` | warning | 非底层过程无 `decomposition` |
| `ASPEC_STYLE_005` | info | 过程无兜底场景（精化时自动补 `others`） |
| `ASPEC_STYLE_006` | error | 重复的 `id` |
| `ASPEC_REFINE_001` | warning | `typeHint` 无法映射，使用占位类型 |
| `BOOK_ALIGN_001` | warning/error | 无功能（过程）文档化 |
| `BOOK_ALIGN_002` | info | Data 缺少 usedBy |
| `BOOK_ALIGN_003` | info | Constraint 缺少 refs |
| `BOOK_ALIGN_004` | warning | 缺少 constraints（strict） |
| `BOOK_ALIGN_005` | info | 对称功能提示 |
| `BOOK_ALIGN_006` | info | 共享 data 提示 |
| `BOOK_ALIGN_007–009` | warning | bookAlign 条目格式 |

## 5. Informal Model DTO 与 IPC

### 5.1 DTO（`@agile-sofl/aspec`）

```typescript
interface InformalDocumentModel {
  meta: AspecMeta
  system: AspecSystem
  modules: InformalModuleDto[]
  diagnostics: AspecDiagnostic[]
  traceability?: TraceabilityGraph
}
```

所有字段 JSON 可序列化，经 Electron IPC 传递（同 [15](./15-Studio可视化编辑器.md) §3）。

### 5.2 Studio IPC

| Channel | 参数 | 返回 |
|---------|------|------|
| `studio:build-informal-model` | `source: string` | `InformalDocumentModel` |
| `studio:patch-aspec` | `{ source, action, path?, value? }` | 新 YAML 文本 |
| `studio:refine-aspec` | `{ source, options?, existingAsfl? }` | `{ asflText, traceability, warnings, diagnostics }` |
| `studio:build-coverage-report` | `{ aspecSource, asflSource, traceJson? }` | `CoverageReport` |
| `studio:patch-informal` | `{ source, span, text }` | 新 `.asfl` 文本 |
| `studio:build-hybrid-regions` | `source: string` | `HybridRegion[]` |
| `studio:open-project-folder` | `path: string` | `ProjectScanResult` |

## 6. 精化算法

### 6.1 `refineToAsfl(document, options)`

**选项**

- `skeletonOnly?: boolean` — 仅签名与空 FSF
- `preserveExisting?: boolean` — 与已有 `.asfl` 按 `id` 合并
- `emitTraceFile?: boolean` — 输出 trace JSON

**映射表**

| Informal | Hybrid |
|----------|--------|
| `module.name` | `module Name [/ Parent];` |
| `type` | `type Name = typeHint;` |
| `const` | `const name = value;` |
| `variable` | `var name: type;` |
| `invariant.textHint` | `inv predicate;` |
| `process` + `scenarios` | `process … FSF : …` |
| `decomposition` | `decom: name` |
| `notes` | `comment: aspec_{id} …` |
| `function` | `function … == undefined` |

**FSF 策略**

- 非底层（`bottomLevel: false`）：Test 用 `informal {condition}` 半形式原子；Def 用占位等式
- 底层（`bottomLevel: true`）：形式占位 `true && outcome_expr`
- 始终追加 `others && …` 兜底场景

精化后调用 `@agile-sofl/parser` 的 `check()`；错误诊断附加到 wizard。

### 6.2 Canonical YAML

Informal patch 采用 **parse → 改 DTO → serialize**（`serializeAspec`），避免 fragile 字符串替换。

## 7. Traceability 与 Coverage

### 7.1 Trace sidecar（`.aspec.trace.json`）

```json
{
  "traceVersion": "1.0",
  "aspecUri": "file:///project/library-informal.aspec",
  "asflUri": "file:///project/library-system.asfl",
  "contentHash": "sha256:…",
  "links": [
    {
      "aspecId": "proc-borrow",
      "kind": "process",
      "asflSymbol": "Borrow",
      "status": "covered"
    }
  ]
}
```

Hybrid `comment:` 行精化时注入 `aspec_{id}` 前缀（下划线替 hyphen），便于 AST 反查。

### 7.2 Coverage 状态

| 状态 | 定义 |
|------|------|
| `covered` | Hybrid 存在同名符号且 FSF 场景数 ≥ informal scenarios |
| `partial` | 符号存在但 FSF/comment 不完整 |
| `missing` | Informal 有、Hybrid 无 |
| `stale` | trace `contentHash` 与当前 aspec 不一致 |

## 8. Studio UI

### 8.1 文档类型

`EditorTab.documentKind: 'asfl' | 'aspec'`；`linkedDocumentId` 配对 informal/hybrid tab。

### 8.2 Informal 编辑器

- **代码**：Monaco `agile-aspec`（YAML 高亮）
- **可视化**：`InformalVisualEditor` — 模块树 + `SystemOverviewCard` + `InformalProcessCard` + 场景列表
- Composable：`useInformalModel`（debounce 300ms，`buildInformalModel` IPC）

### 8.3 精化向导（`RefinementWizard`）

1. 选择 Informal tab + 目标 Hybrid（新建/已有）
2. Diff 预览（Monaco diff editor）
3. 执行 refine → 更新 Hybrid tab → 写 trace file
4. Coverage 面板：列表、百分比、跳转

### 8.4 Hybrid 补齐

- Monaco `buildHybridRegions` 背景装饰（对齐 VS Code POC）
- PredicateBuilder「添加 informal 节点」
- `InformalRegionsPanel`：`getInformalSpans` 清单
- `patchInformal` IPC

### 8.5 项目工作区

- File → Open Folder → `projectStore.root`
- 侧边栏 `.aspec` / `.asfl` 文件树
- Command Center / 项目级 coverage 扫描

## 9. 包边界

```text
aspec       → (yaml, ajv); refine 验收时 devDependency parser
editor-api  → parser; re-export traceability 类型
studio      → aspec, editor-api, parser, language-server
```

禁止 `vscode` ↔ `studio` 源码互引（[13-模块边界与仓库结构.md](./13-模块边界与仓库结构.md)）。

## 10. CLI

```bash
npx aspec validate spec.aspec
npx aspec inspect spec.aspec
npx aspec refine spec.aspec -o out.asfl [--check]
```

## 11. 测试与验收

| 层级 | 内容 |
|------|------|
| `packages/aspec/tests/` | parse、validate、refine 快照、trace、coverage |
| `packages/studio/tests/` | documentKind、informal model IPC smoke |
| 手测 | 新建 .aspec → 填场景 → refine → check 通过 → coverage → 双向跳转 |

## 12. 迭代里程碑（Phase 0–4）

| Phase | 内容 | 状态 |
|-------|------|------|
| P0 | 著作对齐 doc §2、bookAlign schema、示例 | ✅ |
| P1A | aspec BOOK_ALIGN、patch-by-id、merge、coverage CLI | ✅ |
| P1B | Informal 完整可视化 CRUD | ✅ |
| P2 | Hybrid FSF 约束、FSF informal spans | ✅ |
| P3 | merge 向导、CoveragePanel、双向跳转 | ✅ |
| P4 | 全链路测试、手测清单 | ✅ |

## 13. 附录

### A. Informal → Hybrid 精化示例

见 `examples/library-informal.aspec` 与 `examples/library-system.asfl`。

### B. Trace JSON 样例

见 `examples/library-informal.aspec.trace.json`。

### C. 风险

- YAML patch → 结构化 serialize（已实现）
- 三路 merge → `mergeExistingAsfl` + 向导 per-process 策略
- GUI 规格（Ch.4 §4.2）→ 未来 `gui` 模块，当前不阻塞

### E. Phase 差距清单（2026-06 已关闭）

- ~~Informal UI：场景 CRUD、诊断 span 跳转~~ ✅
- ~~Informal UI：bookAlign 表单、types/vars/inv CRUD、toolbar、system 字段~~ ✅
- ~~Hybrid：strict FSF 模式、linked informal hints、FunctionEditor block-informal~~ ✅
- ~~精化：CoveragePanel 条目列表、hybrid span 跳转、per-process merge 表、目标选择~~ ✅
- ~~aspec format IPC、LSP skip for .aspec~~ ✅
- ~~测试：merge 快照、BOOK_ALIGN、patch type/var/inv、bodyHint refine~~ ✅
- ~~GUI 规格模块：`.guispec`、内嵌 `gui`、GuiVisualEditor、Cursor 线框预览~~ ✅（见 [18-GUI规格模块设计.md](./18-GUI规格模块设计.md)）
- 待后续：可交互 GUI 原型、ASFL gui 文法

### D. 迭代记录

| 日期 | 变更 |
|------|------|
| 2026-06 | 初版：aspec 包、Studio 双文档、精化向导、Hybrid 补齐、项目工作区 |
| 2026-06 | Phase 0–4 补全：BOOK_ALIGN、patch-by-id、merge、CoveragePanel、strict FSF、pairs 侧边栏、测试 |
