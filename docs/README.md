# Agile-SOFL 文档索引

本目录是自包含的中文设计与使用文档，介绍 **Agile-SOFL** 语言及本解析器库的实现。所有文法、示例与语义规则均直接写在文档中，可直接复制 `.asfl` 片段运行验证。

## 阅读顺序

| 文档 | 内容 |
|------|------|
| [01-Agile-SOFL-介绍.md](./01-Agile-SOFL-介绍.md) | 动机、与经典 SOFL 的关系、典型开发流程 |
| [02-语言概览.md](./02-语言概览.md) | 规格结构、各段语法、完整 Banking 示例走读 |
| [03-文法参考.md](./03-文法参考.md) | 完整 EBNF、词法规则、正例 |
| [04-类型与表达式.md](./04-类型与表达式.md) | 类型构造、表达式优先级、量词与条件式 |
| [05-FSF-规约.md](./05-FSF-规约.md) | 场景规约、others 分支、形式/半形式判定 |
| [06-解析器与AST设计.md](./06-解析器与AST设计.md) | 流水线、AST 节点、Span、诊断码 |
| [07-语义分析.md](./07-语义分析.md) | 符号表、类型检查、FSF 分类、信息隐藏 |
| [08-API与CLI.md](./08-API与CLI.md) | `parse` / `check` / `inspect` / REPL 用法 |
| [09-测试与贡献.md](./09-测试与贡献.md) | 跑测试、加 fixture、本地验证 |
| [10-编辑器路线图.md](./10-编辑器路线图.md) | LSP 架构与后续能力规划 |
| [11-VSCode扩展与LSP.md](./11-VSCode扩展与LSP.md) | VS Code/Cursor 扩展（私有 VSIX 安装、开发与打包发版） |

## 快速验证

```bash
npm install && npm run build
npx asfl inspect tests/fixtures/integration/banking.asfl
npx asfl repl
npm test
```

## 版本说明

文档描述的是**当前解析器实际支持**的语言子集。若某高级特性尚未实现，会在 [03-文法参考.md](./03-文法参考.md) 中标注「当前版本支持范围」。
