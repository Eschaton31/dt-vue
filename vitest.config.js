import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [vue()],

  resolve: {
    /*
     * An ordered list: the first match wins, so the stylesheet entry has to come
     * before the bare package name (which would otherwise prefix-match it).
     */
    alias: [
      // The OHASIS shim does `import 'dt-vue/styles.css'`.
      { find: 'dt-vue/styles.css', replacement: fileURLToPath(new URL('./src/styles.css', import.meta.url)) },

      // Lets fixtures import the package by name, as a consumer would.
      { find: 'dt-vue', replacement: fileURLToPath(new URL('./src/index.js', import.meta.url)) },

      // The OHASIS shim imports `@/components/buttons/buttonTheme.js`. Only the compat suite needs it.
      { find: '@', replacement: fileURLToPath(new URL('../ohasis/resources/js', import.meta.url)) },
    ],

    // The shim resolves from ohasis/node_modules; share one Vue and one TanStack with src/.
    dedupe: ['vue', '@tanstack/vue-table'],
  },

  // tests/ohasis-compat.test.js reads the shim from the sibling OHASIS checkout.
  server: { fs: { allow: ['..'] } },

  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.js'],
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      reporter: ['text-summary', 'html'],
    },
  },
})
