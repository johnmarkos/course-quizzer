import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { svelteTesting } from '@testing-library/svelte/vite';

export default defineConfig({
  plugins: [svelte({ hot: false }), svelteTesting({ autoCleanup: false })],
  resolve: {
    alias: {
      '$app/navigation': fileURLToPath(
        new URL('./tests/unit/shims/app-navigation.ts', import.meta.url)
      ),
      '$app/state': fileURLToPath(
        new URL('./tests/unit/shims/app-state.ts', import.meta.url)
      ),
      $lib: fileURLToPath(new URL('./src/lib', import.meta.url)),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
