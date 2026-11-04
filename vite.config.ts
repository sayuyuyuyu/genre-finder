import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import devApiPlugin from './scripts/dev-api-plugin.ts';

export default defineConfig({
  plugins: [react(), devApiPlugin()],
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'shared'),
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    target: 'es2022',
    cssCodeSplit: false,
  },
});
