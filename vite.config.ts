import { defineConfig } from 'vitest/config'

// base matches the GitHub Pages project path (https://<owner>.github.io/shipmap/).
export default defineConfig({
  base: '/shipmap/',
  test: {
    include: ['tests/**/*.test.ts'],
  },
})
