import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        statements: 74.9,
        branches: 70,
        functions: 76.8,
        lines: 74.7
      },
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.test.ts',
        '**/*.spec.ts',
        'tests/fixtures/**',
        'src/index.ts', // Just exports, no logic to test
        'examples/**' // Example code
      ]
    },
    testTimeout: 30000,
    hookTimeout: 30000
  }
});
