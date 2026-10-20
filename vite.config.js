import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [vue()],

  build: {
    // Emit a single CSS file (the design tokens) instead of per-chunk assets.
    cssCodeSplit: false,

    lib: {
      entry: fileURLToPath(new URL('src/index.js', import.meta.url)),
      formats: ['es'],
      fileName: () => 'index.js',
    },

    rollupOptions: {
      /*
       * Everything the consumer already has stays out of the bundle.
       * Bundling Vue in particular would give the host app two runtimes.
       *
       * `xlsx` is an optional peer loaded through a dynamic import, so it
       * must stay external for that import to survive into dist.
       */
      external: ['vue', '@tanstack/vue-table', 'xlsx', /^@heroicons\/vue/],

      output: {
        assetFileNames: 'style.css',
        globals: { vue: 'Vue' },
      },
    },
  },
})
