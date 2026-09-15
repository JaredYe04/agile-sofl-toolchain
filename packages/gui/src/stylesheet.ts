/** CSS for the sandboxed GUI prototype. Tokens are injected at runtime. */

export function prototypeStylesheet(vars: Record<string, string> = {}): string {
  const v = (name: string, fallback: string) => vars[name] ?? fallback
  return `:host {
  display: block;
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
}
*, *::before, *::after { box-sizing: border-box; }
:host, .as-app {
  --as-bg: ${v('--gui-canvas', v('--surface-base', '#eef1f4'))};
  --as-raised: ${v('--gui-surface-card', v('--surface-raised', '#fff'))};
  --as-ink: ${v('--gui-ink', v('--text-primary', '#15202b'))};
  --as-body: ${v('--gui-body', v('--text-secondary', '#4a5560'))};
  --as-muted: ${v('--gui-muted', v('--text-muted', '#7a8490'))};
  --as-line: ${v('--gui-hairline', v('--border-subtle', '#d8dee6'))};
  --as-accent: ${v('--gui-primary', v('--accent', '#2563eb'))};
  --as-accent-fg: ${v('--accent-fg', '#f8fafc')};
  --as-danger: ${v('--danger', '#e11d48')};
  --as-field: ${v('--field-bg', '#fff')};
  font-family: "Segoe UI", system-ui, sans-serif;
  color: var(--as-ink);
  background: var(--as-bg);
  font-size: 13px;
  line-height: 1.45;
}
.as-app { display: flex; flex-direction: column; width: 100%; min-height: 100%; }
.as-screen { display: flex; flex-direction: column; gap: 16px; padding: 20px; width: 100%; }
.as-screen.is-hidden { display: none; }
.as-navbar {
  display: flex; flex-direction: row; flex-wrap: wrap; align-items: center; gap: 12px;
  padding: 10px 16px; border-bottom: 1px solid var(--as-line);
  background: var(--as-raised); width: 100%;
}
.as-row { display: flex; flex-direction: row; flex-wrap: wrap; align-items: center; }
.as-col { display: flex; flex-direction: column; }
.as-stack { display: flex; flex-direction: column; }
.as-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
.as-gap-sm { gap: 8px; }
.as-gap-md { gap: 12px; }
.as-gap-lg { gap: 20px; }
.as-card {
  background: var(--as-raised);
  border: 1px solid var(--as-line);
  border-radius: 10px;
  padding: 16px;
  box-shadow: 0 1px 2px rgb(0 0 0 / 6%);
}
.as-title { font-size: 18px; font-weight: 650; margin: 0; }
.as-muted, .as-hint { color: var(--as-muted); margin: 0; }
.as-field { display: flex; flex-direction: column; gap: 6px; font-weight: 500; }
.as-input, .as-select, textarea.as-input {
  border: 1px solid var(--as-line);
  background: var(--as-field);
  color: var(--as-ink);
  border-radius: 8px;
  padding: 8px 10px;
  min-height: 32px;
}
.as-input:focus, .as-select:focus { outline: 2px solid color-mix(in srgb, var(--as-accent) 40%, transparent); border-color: var(--as-accent); }
.as-btn {
  display: inline-flex; align-items: center; justify-content: center;
  flex: 0 0 auto; white-space: nowrap;
  border-radius: 8px; border: 1px solid var(--as-line);
  background: var(--as-raised); color: var(--as-ink);
  padding: 8px 14px; min-height: 32px; cursor: pointer; font-weight: 600;
}
.as-btn-primary { background: var(--as-accent); color: var(--as-accent-fg); border-color: transparent; }
.as-btn-ghost { background: transparent; }
.as-table { width: 100%; border-collapse: collapse; background: var(--as-raised); }
.as-table th, .as-table td { border: 1px solid var(--as-line); padding: 8px 10px; text-align: left; }
.as-list { margin: 0; padding-left: 18px; }
`
}
