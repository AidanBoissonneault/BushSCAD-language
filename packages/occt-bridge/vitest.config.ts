/**
 * @author Aidan Boissonneault
 * @file vitest.config.ts
 * @purpose Provides vitest config behavior for the packages OpenCascade bridge in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: ['dist/**', '**/node_modules/**', '**/.git/**'],
  },
});
