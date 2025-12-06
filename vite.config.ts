import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    sourcemap: false, // Prevents 404 errors for .map files in console
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:6002',
        changeOrigin: true,
        secure: false,
      }
    }
  }
});