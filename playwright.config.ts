import { defineConfig, devices } from '@playwright/test'

const dist = process.env.E2E_DIST === '1'
const port = dist ? 4173 : 5173
const url = `http://localhost:${port}/shipmap/`

export default defineConfig({
  testDir: 'tests/e2e',
  ...(dist ? { testMatch: 'dist.spec.ts' } : { testIgnore: 'dist.spec.ts' }),
  use: { baseURL: url },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: dist ? 'npm run build && npm run preview -- --port 4173 --strictPort' : 'npm run dev',
    url,
    reuseExistingServer: !process.env.CI,
  },
})
