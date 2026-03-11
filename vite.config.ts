import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  base: '/teamtree/',
  plugins: [react()],
  server: {
    proxy: {
      // Match the sub-path prefix (base) so dev requests mirror the nginx setup.
      // /teamtree/api/... → http://localhost:3001/api/...
      '/teamtree/api': {
        target: 'http://localhost:3001',
        rewrite: (path) => path.replace(/^\/teamtree/, ''),
      },
    },
  },
})
