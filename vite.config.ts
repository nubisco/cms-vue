import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import dts from 'vite-plugin-dts'

// Library build: bundle the ES entry, externalize Vue (peer dependency), and
// roll all declarations up into a single dist/index.d.ts so consumers never
// resolve .vue files from the package.
export default defineConfig({
  plugins: [vue(), dts({ rollupTypes: true, tsconfigPath: './tsconfig.json' })],
  build: {
    lib: {
      entry: fileURLToPath(new URL('./src/index.ts', import.meta.url)),
      formats: ['es'],
      fileName: () => 'index.js',
    },
    rollupOptions: {
      // Vue is a peer, and the core is a real dependency: BOTH stay external.
      // Bundling the core in would defeat the point of extracting it. A consumer
      // would get the link and richtext models twice, once inlined here and once
      // from the package a future cms-react would also depend on, and the two
      // copies would answer `instanceof` and identity checks differently.
      external: ['vue', '@nubisco/cms-core'],
    },
    emptyOutDir: true,
  },
})
