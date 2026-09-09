import { parseInformalSpec } from './parser.js'
import type { InformalNode, InformalSpecification } from './model.js'

function nestedOf(node: InformalNode): InformalNode[] {
  return (node.metadata?.nested as InformalNode[] | undefined) ?? []
}

function clip(text: string, n: number): string {
  const compact = text.replace(/\s+/g, ' ').trim()
  if (compact.length <= n) return compact
  return `${compact.slice(0, Math.max(0, n - 1))}…`
}

/** Structured inventory the agent uses to update/remove existing nodes by id. */
export function formatInformalInventory(
  spec: InformalSpecification | null,
  maxChars = 12000
): string {
  if (!spec) return '(empty informal specification)'
  const lines: string[] = []
  for (const section of spec.sections) {
    lines.push(`## ${section.title} [${section.type}]`)
    const walk = (nodes: InformalNode[], depth: number) => {
      if (!nodes.length && depth === 0) {
        lines.push('- (empty)')
        return
      }
      for (const node of nodes) {
        const desc = node.description?.trim() ? ` — ${clip(node.description, 240)}` : ''
        lines.push(`${'  '.repeat(depth)}- ${node.id} (${node.type}) ${node.title}${desc}`)
        walk(nestedOf(node), depth + 1)
      }
    }
    walk(section.children, 0)
    lines.push('')
  }
  const text = lines.join('\n').trim()
  if (text.length <= maxChars) return text
  return `${text.slice(0, maxChars)}\n…(truncated)`
}

export function informalInventoryFromMarkdown(markdown: string, maxChars = 12000): string {
  const { specification } = parseInformalSpec(markdown)
  return formatInformalInventory(specification, maxChars)
}
