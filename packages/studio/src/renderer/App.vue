<script setup lang="ts">
import { ref, onMounted } from 'vue'

const SAMPLE = `module SYSTEM_Demo;
process Demo (x: nat) ok: nat
FSF :
x > 0 && ok = 1 ||
others && ok = 0
decom: DemoDecom
comment: informal note
end_process
end_module`

const modules = ref<string[]>([])
const lspStatus = ref('checking…')
const errorCount = ref(0)

onMounted(async () => {
  const model = await window.studio?.buildDocumentModel(SAMPLE)
  if (model) {
    modules.value = model.modules
    errorCount.value = model.errorCount
  }

  const status = await window.studio?.getLspStatus()
  lspStatus.value = status?.message ?? 'LSP bridge unavailable'
})
</script>

<template>
  <main class="layout">
    <header>
      <h1>Agile-SOFL Studio</h1>
      <p class="subtitle">Electron + Vue shell — FSF blocks / module graph UI TODO</p>
    </header>
    <section class="panel">
      <h2>Document model</h2>
      <p>Modules: {{ modules.join(', ') || '—' }}</p>
      <p>Diagnostics (errors): {{ errorCount }}</p>
    </section>
    <section class="panel">
      <h2>LSP (main process)</h2>
      <p>{{ lspStatus }}</p>
    </section>
    <section class="panel todo">
      <h2>Planned panels</h2>
      <ul>
        <li>Monaco text editor + LSP client</li>
        <li>FSF form blocks via editor-api</li>
        <li>Module relationship graph</li>
      </ul>
    </section>
  </main>
</template>

<style>
body {
  margin: 0;
  font-family: system-ui, sans-serif;
  background: #1e1e1e;
  color: #ddd;
}
.layout {
  padding: 1.5rem;
  max-width: 960px;
}
.subtitle {
  color: #888;
}
.panel {
  background: #2d2d2d;
  border-radius: 8px;
  padding: 1rem 1.25rem;
  margin-top: 1rem;
}
.todo ul {
  margin: 0.5rem 0 0;
  padding-left: 1.25rem;
  color: #aaa;
}
</style>
