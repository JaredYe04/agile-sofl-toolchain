/**
 * XML serialisation of modules (final grammar G:36-38: "When a single module is saved, it will
 * be saved into both a 'text' file and a 'XML' file automatically").
 *
 * Format (schema v1, generic AST mapping):
 *   <asfl-module xmlns="urn:agile-sofl:module:1" name="…" system="true|false" parent="…">
 *     <source><![CDATA[ …module text… ]]></source>
 *     <ast> <module …> … </module> </ast>
 *   </asfl-module>
 * Every AST node becomes an element named after its `type`; scalar fields become attributes,
 * object/array fields become child elements wrapped in <field name="…">. Spans become
 * line/column/start/end attributes.
 */
import type { ModuleNode, ProgramNode } from '../ast/nodes.js'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const cdata = (s: string) => `<![CDATA[${s.replace(/]]>/g, ']]]]><![CDATA[>')}]]>`
const tag = (s: string) => s.replace(/[^A-Za-z0-9_.-]/g, '_').replace(/^([^A-Za-z_])/, '_$1')

function nodeToXml(node: any, indent: string): string {
  if (node === null || node === undefined) return ''
  if (typeof node !== 'object') return `${indent}<value>${esc(String(node))}</value>\n`
  if (Array.isArray(node)) return node.map((n) => nodeToXml(n, indent)).join('')
  const name = tag(typeof node.type === 'string' ? node.type : 'object')
  const attrs: string[] = []
  const kids: string[] = []
  for (const [k, v] of Object.entries(node)) {
    if (k === 'type' || v === undefined) continue
    if (k === 'span' && v && typeof v === 'object') {
      const s = v as any
      attrs.push(`line="${s.line}"`, `column="${s.column}"`, `start="${s.start}"`, `end="${s.end}"`)
      continue
    }
    if (k.endsWith('Span')) continue
    if (v === null || typeof v !== 'object') attrs.push(`${tag(k)}="${esc(String(v))}"`)
    else if (Array.isArray(v) && v.every((x) => x === null || typeof x !== 'object')) {
      kids.push(`${indent}  <field name="${esc(k)}">${v.map((x) => `<value>${esc(String(x))}</value>`).join('')}</field>\n`)
    } else {
      const inner = nodeToXml(v, indent + '    ')
      kids.push(`${indent}  <field name="${esc(k)}">\n${inner}${indent}  </field>\n`)
    }
  }
  const open = `${indent}<${name}${attrs.length ? ' ' + attrs.join(' ') : ''}`
  return kids.length ? `${open}>\n${kids.join('')}${indent}</${name}>\n` : `${open}/>\n`
}

/** Module source text (exact slice of the specification). */
export function moduleSourceText(source: string, module: ModuleNode): string {
  return source.slice(module.span.start, module.span.end)
}

export function moduleToXml(module: ModuleNode, source: string): string {
  const name = module.isSystem ? `SYSTEM_${module.name}` : module.name
  const parent = module.parent?.name ? ` parent="${esc(module.parent.name)}"` : ''
  return `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<asfl-module xmlns="urn:agile-sofl:module:1" schemaVersion="1" name="${esc(name)}" system="${module.isSystem}"${parent}>\n` +
    `  <source>${cdata(moduleSourceText(source, module))}</source>\n` +
    `  <ast>\n${nodeToXml(module, '    ')}  </ast>\n` +
    `</asfl-module>\n`
}

export interface ModuleArtifact { moduleName: string; text: string; xml: string }

/** Text + XML artifacts for every module of a parsed program. */
export function moduleArtifacts(program: ProgramNode, source: string): ModuleArtifact[] {
  return program.modules.map((m) => {
    const moduleName = m.isSystem ? `SYSTEM_${m.name}` : m.name
    const text = moduleSourceText(source, m)
    return { moduleName, text: text.endsWith('\n') ? text : text + '\n', xml: moduleToXml(m, source) }
  })
}
