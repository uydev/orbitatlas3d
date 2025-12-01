import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: { port: 5173, strictPort: true },
  logLevel: 'info', // 'info' shows more detail than default, 'verbose' for even more
  build: {
    minify: 'esbuild', // faster than terser
    sourcemap: false, // disable sourcemaps to speed up build
    rollupOptions: {
      output: {
        manualChunks: {
          'cesium': ['cesium'], // split Cesium into its own chunk
        }
      }
    }
  },
  define: {
    CESIUM_BASE_URL: JSON.stringify('/cesium'),
    'import.meta.env.VITE_API_URL': JSON.stringify(process.env.VITE_API_URL || 'http://localhost:8000'),
    'import.meta.env.VITE_CESIUM_ION_TOKEN': JSON.stringify(process.env.VITE_CESIUM_ION_TOKEN || '')
  }
}))



