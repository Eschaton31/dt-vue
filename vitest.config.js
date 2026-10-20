import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [vue()],

  resolve: {
    alias: {
      // Lets fixtures import the package by name, as a consumer would.
      'dt-vue': fileURLToPath(new URL('./src/index.js', import.meta.url)),
    },
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
