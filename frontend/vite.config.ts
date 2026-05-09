import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
  ],
  build: {
    target: 'es2020',
    cssMinify: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('scheduler')) {
              return 'vendor';
            }
            if (id.includes('recharts') || id.includes('d3')) {
              return 'charts';
            }
            if (id.includes('socket.io-client')) {
              return 'socket';
            }
          }
        },
      },
    },
  },
})
