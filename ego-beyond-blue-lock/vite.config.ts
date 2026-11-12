import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Relative base so the built game can be hosted from any sub-path (e.g. GitHub Pages).
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { target: 'es2022', chunkSizeWarningLimit: 2500 },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 240000,
    hookTimeout: 240000,
  },
});
