import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';

const manifest = readFileSync(new URL('./manifest.json', import.meta.url), 'utf8');

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'emit-web-manifest',
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'manifest.json',
          source: manifest,
        });
      },
    },
  ],
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
});
