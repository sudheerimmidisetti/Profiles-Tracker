import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Directly reuse student UI components in admin
      '@student': path.resolve(__dirname, '../student/src'),

      // Force all package imports — including those coming from @student files —
      // to resolve from admin/node_modules. Without this, Cloudflare Pages fails
      // because it only installs admin deps (student/node_modules doesn't exist).
      'lucide-react':    path.resolve(__dirname, 'node_modules/lucide-react'),
      'recharts':        path.resolve(__dirname, 'node_modules/recharts'),
      'axios':           path.resolve(__dirname, 'node_modules/axios'),
      'react':           path.resolve(__dirname, 'node_modules/react'),
      'react-dom':       path.resolve(__dirname, 'node_modules/react-dom'),
      'react-router-dom': path.resolve(__dirname, 'node_modules/react-router-dom'),
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react':    ['react', 'react-dom', 'react-router-dom'],
          'vendor-charts':   ['recharts'],
          'vendor-ui':       ['lucide-react'],
          'vendor-http':     ['axios'],
        }
      }
    }
  },
  server: {
    port: 5174,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  }
})
