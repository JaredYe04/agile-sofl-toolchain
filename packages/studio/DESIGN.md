# Agile-SOFL Studio — DESIGN.md

Design contract for AI agents and contributors. Hybrid strategy: **Shell** keeps VS Code–style IDE tokens; **Visual panel** uses Cursor/Linear-inspired card forms.

## 1. Visual Theme & Atmosphere

| Zone | Mood | Density |
|------|------|---------|
| Shell (TitleBar, Tabs, Monaco) | IDE precision, low chrome | High |
| Visual panel | Editorial cards, hairline borders, generous padding | Medium |

- No heavy shadows; use 1px `--border-subtle` / `--field-border`.
- 8px grid: spacing 4 / 8 / 12 / 16 / 24px.
- Radii: panels `rounded-lg` (8px), fields `rounded-md` (6px).

## 2. Color Palette & Roles

### Shell (unchanged)

| Token | Light | Dark | Role |
|-------|-------|------|------|
| `--surface-base` | `#f3f3f3` | `#1e1e1e` | Window background |
| `--surface-raised` | `#ffffff` | `#252526` | Panels, tabs |
| `--accent` | `#0078d4` | `#3794ff` | Focus, links, primary actions |

### Visual / Form

| Token | Maps to | Role |
|-------|---------|------|
| `--field-bg` | `--surface-raised` | Input & mini-Monaco background |
| `--field-border` | `--border-subtle` | Single field outline |
| `--field-border-focus` | `--accent` | Focus ring |
| `--role-process` | `#0ea5e9` / `#38bdf8` | Process labels, graph rows |
| `--role-function` | `#f97316` / `#fb923c` | Function labels |
| `--semantic-warning` | `#d97706` / `#fbbf24` | Parse warnings |
| `--semantic-error` | `#e11d48` / `#fb7185` | Field / parse errors |

## 3. Typography

| Use | Font | Size |
|-----|------|------|
| Visual UI | system-ui stack | 14px base |
| Labels | same, `font-medium` | 13px |
| Code fields | JetBrains Mono / Consolas | 13px |
| Captions | same | 11–12px, `--text-muted` |

## 4. Component Stylings

### SectionCard
- `bg-surface-raised border border-border-subtle rounded-lg p-4`
- Optional `title` slot with bottom hairline

### FormField
- Label above slot; error text below in `--semantic-error`
- Single child: `TextField` or `CodeField`

### TextField / CodeField
- **One border owner** per field: `border border-field-border rounded-md bg-field-bg`
- Focus: `focus-within:ring-2 ring-accent/40 ring-offset-1`
- CodeField: Monaco fills container 100%; no transparent background hack

### FieldGroup (predicate nodes)
- `border-l-2 border-accent/30 pl-3 py-1` — no nested full box around Monaco

### Badge
- `rounded px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide`
- Variants: `process`, `function`, `formal`, `semi-formal`, `warning`

## 5. Layout Principles

- Visual detail panel: `studio-scroll` vertical scroll; cards stacked with `space-y-4`.
- FSF scenario cards: left accent bar (Test = accent, Def = role-process).
- Toolbar: 36px height; semantic role colors via tokens only (no raw `sky-500`).

## 6. Do's and Don'ts

**Do**
- Use semantic tokens for all visual colors.
- Keep Monaco mini-fields border-aligned with native textareas.
- Block FSF save when predicate parse errors exist.

**Don't**
- Stack `border` on both parent FieldGroup and child CodeField.
- Use `transparent !important` on Monaco layers without matching container bg.
- Hard-code Tailwind palette colors in visual components.

## 7. Agent Prompt Guide

```
Visual panel: card-based forms on --surface-raised, hairline borders, 8px grid.
Fields: FormField + TextField or CodeField (single border). Process orange-blue via --role-process, function via --role-function.
Shell: keep --accent blue IDE chrome unchanged.
```
