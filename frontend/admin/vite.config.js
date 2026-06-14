import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

const STUDENT_API_PATH = path.resolve(__dirname, '../student/src/api/api.js')
const STUB_PATH        = path.resolve(__dirname, 'src/stubs/student-api-stub.js')

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      // ── CRITICAL: Intercept the student api/api.js import ───────────────────
      // ContestDetailPanel (in student/src/components/) does:
      //   import api from '../api/api'
      // Which resolves to student/src/api/api.js — that file has a response
      // interceptor that calls window.location='/login' on 401, logging admin out.
      //
      // We use a regex `find` so Vite matches the RESOLVED absolute path, not
      // the raw import string. The \0 virtual module prefix handles edge cases.
      {
        find: STUDENT_API_PATH,
        replacement: STUB_PATH,
      },
      // Also match the @student alias resolving to api/api (belt-and-suspenders)
      {
        find: /^@student\/api\/api(\.js)?$/,
        replacement: STUB_PATH,
      },

      // ── Directly reuse student UI components in admin ───────────────────────
      { find: '@student', replacement: path.resolve(__dirname, '../student/src') },

      // ── Force all package imports to resolve from admin/node_modules ─────────
      // Without this, EC2 fails because student/node_modules may not be installed.
      { find: 'lucide-react',     replacement: path.resolve(__dirname, 'node_modules/lucide-react') },
      { find: 'recharts',         replacement: path.resolve(__dirname, 'node_modules/recharts') },
      { find: 'axios',            replacement: path.resolve(__dirname, 'node_modules/axios') },
      { find: 'react',            replacement: path.resolve(__dirname, 'node_modules/react') },
      { find: 'react-dom',        replacement: path.resolve(__dirname, 'node_modules/react-dom') },
      { find: 'react-router-dom', replacement: path.resolve(__dirname, 'node_modules/react-router-dom') },
    ]
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react':  ['react', 'react-dom', 'react-router-dom'],
          'vendor-charts': ['recharts'],
          'vendor-ui':     ['lucide-react'],
          'vendor-http':   ['axios'],
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
