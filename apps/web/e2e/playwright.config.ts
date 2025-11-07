import { defineConfig } from '@playwright/test'
export default defineConfig({
  webServer: {
    command: 'npm run preview',
    port: 5173,
    reuseExistingServer: true
  },
  use: { baseURL: 'http://localhost:5173' }
})



