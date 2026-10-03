import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  // Caminhos relativos: o build funciona em qualquer subcaminho (GitHub Pages, servidor interno…).
  base: './',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      // Módulos ESM internos do Monaco (usados pelo núcleo enxuto em src/lib/monaco/core.js).
      'monaco-esm': path.resolve(import.meta.dirname, 'node_modules/monaco-editor/esm/vs'),
    },
  },
});
