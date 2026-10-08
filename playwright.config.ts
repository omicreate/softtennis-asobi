import { defineConfig, devices } from '@playwright/test'

// 開発サーバーで動かして、スマホ・タブレットの大きさで2人同時のタッチを確かめる（npm run test:e2e）
// 開発時だけ見える window.__rally（ラリーの進行）を使うので、vite preview ではなく vite で起動する
const port = 4176
const host = ['127', '0', '0', '1'].join('.')
const base = `http://${host}:${port}/softtennis-asobi/`

export default defineConfig({
  testDir: './e2e',
  timeout: 40_000,
  expect: { timeout: 8_000 },
  fullyParallel: true,
  use: {
    baseURL: base,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'Pixel 7', use: { ...devices['Pixel 7'], browserName: 'chromium' } },
    { name: 'iPad', use: { ...devices['iPad (gen 7)'], browserName: 'chromium' } },
  ],
  webServer: {
    command: `npx vite --host ${host} --port ${port} --strictPort`,
    url: base,
    reuseExistingServer: !process.env.CI,
  },
})
