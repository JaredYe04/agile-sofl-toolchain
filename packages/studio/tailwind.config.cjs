/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{vue,ts,html}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        surface: {
          base: 'var(--surface-base)',
          raised: 'var(--surface-raised)',
          overlay: 'var(--surface-overlay)'
        },
        content: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)'
        },
        accent: 'var(--accent)',
        border: {
          subtle: 'var(--border-subtle)',
          field: 'var(--field-border)'
        },
        field: {
          bg: 'var(--field-bg)',
          border: 'var(--field-border)',
          'border-focus': 'var(--field-border-focus)'
        },
        role: {
          process: 'var(--role-process)',
          function: 'var(--role-function)'
        },
        semantic: {
          warning: 'var(--semantic-warning)',
          error: 'var(--semantic-error)'
        },
        danger: 'var(--danger)',
        gui: {
          canvas: 'var(--gui-canvas)',
          'canvas-soft': 'var(--gui-canvas-soft)',
          ink: 'var(--gui-ink)',
          body: 'var(--gui-body)',
          hairline: 'var(--gui-hairline)',
          primary: 'var(--gui-primary)',
          'surface-card': 'var(--gui-surface-card)'
        }
      }
    }
  },
  plugins: []
}
