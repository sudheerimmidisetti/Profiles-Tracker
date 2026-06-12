import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Directly reuse student UI components in admin
      '@student': path.resolve(__dirname, '../student/src'),

      // Redirect the student's api/api.js to a safe stub with no auth interceptors.
      // ContestDetailPanel imports this to fetch /api/contest/detail. In the admin
      // context there's no student JWT, so the request returns 401. Without this stub,
      // the student api's response interceptor catches the 401 and does
      // window.location.href='/login' — logging the admin out.
      [path.resolve(__dirname, '../student/src/api/api.js')]:
        path.resolve(__dirname, 'src/stubs/student-api-stub.js'),

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
