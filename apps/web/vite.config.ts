import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: { port: 5173, strictPort: true },
  define: {
    CESIUM_BASE_URL: JSON.stringify('/cesium'),
    'import.meta.env.VITE_API_URL': JSON.stringify(process.env.VITE_API_URL || 'http://localhost:8000'),
    'import.meta.env.VITE_CESIUM_ION_TOKEN': JSON.stringify(process.env.VITE_CESIUM_ION_TOKEN || '')
  }
}))



