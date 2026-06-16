import { describe, it, expect } from 'vitest'
import { parseGuiBlock, check } from '../src/index.js'

describe('gui block parser', () => {
  it('extracts screens and widgets', () => {
    const src = `gui Lib;
screen A;
    label t "Title";
end_screen;
end_gui;`
    const { gui } = parseGuiBlock(src, 0, src.length)
    expect(gui?.screens).toHaveLength(1)
    expect(gui?.screens[0]?.widgets[0]?.kind).toBe('label')
  })

  it('integrates with check pipeline', () => {
    const source = `module SYSTEM_M;
inv
    true;
gui G;
screen S;
    label w "Hi";
end_screen;
end_gui;
process P ()
    FSF :
    others && true
end_process
end_module`
    const result = check(source)
    expect(result.diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0)
    expect(result.ast?.modules[0]?.gui?.name).toBe('G')
  })
})
