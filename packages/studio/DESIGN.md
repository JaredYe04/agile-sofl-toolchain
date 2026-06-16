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

## 8. GUI Preview Zone (Cursor-inspired)

Reference: [VoltAgent awesome-design-md — Cursor](https://github.com/VoltAgent/awesome-design-md/blob/main/design-md/cursor/DESIGN.md).

| Token | Value | Role |
|-------|-------|------|
| `--gui-canvas` | `#f7f7f4` | Warm cream preview background |
| `--gui-ink` | `#26251e` | Titles |
| `--gui-body` | `#5a5852` | Secondary text |
| `--gui-hairline` | `#e6e5e0` | 1px borders (no shadow) |
| `--gui-primary` | `#f54e00` | Primary button (Cursor Orange) |
| `--gui-surface-card` | `#ffffff` | Screen card |
| `--gui-timeline-*` | pastel set | Widget kind badges only |

Font: **Inter** (CursorGothic substitute). Scope: `.gui-preview` only — Shell IDE tokens unchanged.
```

## 9. New File Dialog

- **Blank starters** (top section): dashed `border-accent/30`, 3-column large cards, document icon + extension badge.
- **Example templates** (below): solid `border-border-subtle`, 2-column compact cards grouped by ASFL / Informal / GUI.
- Section headers: primary title for blanks; uppercase muted captions for example groups.
- No heavy shadows; hairline borders only. Escape closes dialog.

## 10. Project Sidebar

- **Width**: default 260px, draggable 200–420px; persisted in localStorage.
- **Collapse**: toolbar panel icon, View menu, `Ctrl+B`, resize bar chevron (hover center); persisted visibility.
- **Expand affordance**: when collapsed, hover the left edge (vertical center) to reveal a chevron button.
- **Pair cards**: expandable; show `.aspec` / `.asfl` / `.guispec` rows with Badge; status pill (Full / Partial / Informal only).
- **Unpaired section**: grouped by extension, collapsed by default.
- **Context menu**: pair/file rows (open, reveal, copy path); panel blank (open folder, refresh, close project, collapse).
- Active tab file path highlights matching row.
