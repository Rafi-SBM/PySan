import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/**
 * The base path differs per deployment target:
 *
 *   GitHub Pages project site -> /PySan/   (the default)
 *   custom domain or root      -> PYSAN_BASE=/
 *   local preview of a build   -> PYSAN_BASE=/
 */
const base = process.env.PYSAN_BASE ?? '/PySan/';

export default defineConfig({
  base,
  plugins: [react()],
  build: {
    target: 'es2020',
    sourcemap: true,
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    // jsdom exposes localStorage only for a non-opaque origin.
    environmentOptions: { jsdom: { url: 'http://localhost:5173/' } },
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/lib/**/*.ts'],
    },
  },
});
