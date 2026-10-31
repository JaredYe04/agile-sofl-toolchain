// electron.vite.config.ts
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import vue from "@vitejs/plugin-vue";
import monacoNlsAdapter from "monaco-editor-nls-adapter";
import { resolve } from "node:path";
var __electron_vite_injected_dirname = "D:\\repos\\agile-sofl-toolchain\\packages\\studio";
var monacoNlsPlugin = monacoNlsAdapter.vitePlugin;
function removeCrossorigin() {
  return {
    name: "remove-crossorigin",
    transformIndexHtml(html) {
      return html.replace(/\s+crossorigin(="[^"]*")?/gi, "");
    }
  };
}
var monorepoExternals = [
  "@agile-sofl/parser",
  "@agile-sofl/gui",
  "@agile-sofl/editor-api",
  "@agile-sofl/language-server"
];
var electron_vite_config_default = defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__electron_vite_injected_dirname, "src/main/index.ts")
        },
        external: monorepoExternals
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__electron_vite_injected_dirname, "src/preload/index.ts")
        }
      }
    }
  },
  renderer: {
    base: "./",
    root: resolve(__electron_vite_injected_dirname, "src/renderer"),
    publicDir: resolve(__electron_vite_injected_dirname, "public"),
    server: {
      // A production preview inlines Monaco as a data URL and the workspace never mounts.
      // Dev keeps the real Monaco URL. Capture turns HMR off so a save cannot wipe the window.
      hmr: process.env.STUDIO_CAPTURE === "1" ? false : void 0,
      sourcemapIgnoreList(sourcePath) {
        return sourcePath.replace(/\\/g, "/").includes("monaco-editor");
      }
    },
    resolve: {
      alias: {
        "@agile-sofl/editor-api": resolve(__electron_vite_injected_dirname, "src/renderer/lib/editorApiRenderer.ts"),
        // Main process loads CJS from dist; renderer bundles ESM from source.
        "@agile-sofl/gui": resolve(__electron_vite_injected_dirname, "../gui/src/index.ts"),
        "monaco-editor-nls-adapter/proxy": resolve(__electron_vite_injected_dirname, "src/renderer/monaco/nlsProxy.js"),
        echarts: resolve(__electron_vite_injected_dirname, "../../node_modules/echarts")
      }
    },
    build: {
      modulePreload: {
        polyfill: false
      },
      rollupOptions: {
        input: {
          index: resolve(__electron_vite_injected_dirname, "src/renderer/index.html")
        }
      }
    },
    plugins: [vue(), monacoNlsPlugin({ languages: ["zh-hans"] }), removeCrossorigin()],
    css: {
      postcss: resolve(__electron_vite_injected_dirname, "postcss.config.cjs")
    },
    worker: {
      format: "es"
    },
    // Exclude monaco-editor from prebundle so monacoNlsPlugin can inject zh-hans at dev time.
    // Clear node_modules/.vite after changing this if context menu stays English.
    optimizeDeps: {
      exclude: ["monaco-editor"],
      include: ["vditor", "echarts", "zrender"]
    }
  }
});
export {
  electron_vite_config_default as default
};
