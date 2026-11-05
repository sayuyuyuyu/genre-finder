import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import devApiPlugin from './scripts/dev-api-plugin.ts';

// ESM では __dirname が無いので import.meta.url から解決する
const projectRoot = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  plugins: [react(), devApiPlugin()],
  resolve: {
    alias: {
      '@shared': resolve(projectRoot, 'shared'),
      '@': resolve(projectRoot, 'src'),
    },
  },
  build: {
    target: 'es2022',
    cssCodeSplit: false,
  },
});
