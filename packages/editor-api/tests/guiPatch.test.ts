import { describe, it, expect } from 'vitest'
import { parse } from '@agile-sofl/parser'
import { patchGuiWidgetText } from '../src/guiPatch.js'

describe('patchGuiWidgetText', () => {
  it('replaces widget string literal', () => {
    const source = `module SYSTEM_M;
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
    const { ast } = parse(source)
    expect(ast?.type).toBe('program')
    const next = patchGuiWidgetText(source, ast!, 'M', 'S', 'w', 'Hello')
    expect(next).toContain('"Hello"')
    expect(next).not.toContain('"Hi"')
  })
})
