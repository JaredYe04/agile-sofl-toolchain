import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { AGENT_SKILLS, AGENT_TOOLS } from '../src/main/services/llm/skills'

const llmDir = join(__dirname, '..', 'src', 'main', 'services', 'llm')
const TEMPLATE = 'T1 && D1 || T2 && D2 || … || others && Dn'

/** All string literals that are prompt text (skill prompts + tool descriptions + agentLoop system text). */
function promptTexts(): string[] {
  const texts = [...AGENT_SKILLS.map((s) => s.prompt), JSON.stringify(AGENT_TOOLS)]
  const loop = readFileSync(join(llmDir, 'agentLoop.ts'), 'utf-8')
  // template literals and quoted strings that read like prose (contain a space and a letter)
  for (const m of loop.matchAll(/`([^`]*)`|'((?:[^'\\]|\\.)*)'/g)) {
    const t = m[1] ?? m[2] ?? ''
    if (/[a-z] [a-z]/i.test(t) && t.length > 30) texts.push(t)
  }
  return texts
}

describe('LLM prompts follow the final Agile-SOFL grammar', () => {
  it('do not mention implies or => as a logical operator', () => {
    for (const t of promptTexts()) {
      expect(t).not.toMatch(/\bimplies\b/i)
      expect(t).not.toMatch(/(^|[^=])=>\s*[a-z(]/i) // e.g. "A => B" in prose
      expect(t).not.toMatch(/\bor =>/)
    }
  })

  it('no longer forbid writing FSF :', () => {
    for (const t of promptTexts()) {
      expect(t).not.toMatch(/never (write )?FSF/i)
      expect(t).not.toMatch(/not FSF/i)
    }
  })

  it('give the final-grammar FSF template', () => {
    const all = promptTexts().join('\n')
    expect(all).toContain(TEMPLATE)
    expect(JSON.stringify(AGENT_TOOLS)).toContain('fsf')
  })
})
