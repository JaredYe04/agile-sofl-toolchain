import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'
import monacoNlsAdapter from 'monaco-editor-nls-adapter'
import type { Plugin } from 'vite'

const monacoNlsPlugin = monacoNlsAdapter.vitePlugin
import { resolve } from 'node:path'

function removeCrossorigin(): Plugin {
  return {
    name: 'remove-crossorigin',
    transformIndexHtml(html) {
      return html.replace(/\s+crossorigin(="[^"]*")?/gi, '')
    }
  }
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/main/index.ts')
        }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/preload/index.ts')
        }
      }
    }
  },
  renderer: {
    base: './',
    root: resolve(__dirname, 'src/renderer'),
    publicDir: resolve(__dirname, 'public'),
    server: {
      sourcemapIgnoreList(sourcePath) {
        return sourcePath.replace(/\\/g, '/').includes('monaco-editor')
      }
    },
    resolve: {
      alias: {
        '@agile-sofl/editor-api': resolve(__dirname, 'src/renderer/lib/editorApiRenderer.ts'),
        'monaco-editor-nls-adapter/proxy': resolve(__dirname, 'src/renderer/monaco/nlsProxy.js')
      }
    },
    build: {
      modulePreload: {
        polyfill: false
      },
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/renderer/index.html')
        }
      }
    },
    plugins: [vue(), monacoNlsPlugin({ languages: ['zh-hans'] }), removeCrossorigin()],
    css: {
      postcss: resolve(__dirname, 'postcss.config.cjs')
    },
    worker: {
      format: 'es'
    },
    // Exclude monaco-editor from prebundle so monacoNlsPlugin can inject zh-hans at dev time.
    // Clear node_modules/.vite after changing this if context menu stays English.
    optimizeDeps: {
      exclude: ['monaco-editor']
    }
  }
})
