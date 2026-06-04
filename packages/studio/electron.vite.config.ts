import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'
import monacoNlsAdapter from 'monaco-editor-nls-adapter'

const monacoNlsPlugin = monacoNlsAdapter.vitePlugin
import { resolve } from 'node:path'

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
    root: resolve(__dirname, 'src/renderer'),
    publicDir: resolve(__dirname, 'public'),
    server: {
      sourcemapIgnoreList(sourcePath) {
        return sourcePath.replace(/\\/g, '/').includes('monaco-editor')
      }
    },
    resolve: {
      alias: {
        'monaco-editor-nls-adapter/proxy': resolve(
          __dirname,
          '../../node_modules/monaco-editor-nls-adapter/proxy.js'
        )
      }
    },
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/renderer/index.html')
        }
      }
    },
    plugins: [
      vue(),
      monacoNlsPlugin({ languages: ['zh-hans'] })
    ],
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
