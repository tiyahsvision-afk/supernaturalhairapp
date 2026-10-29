import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    setupFiles: ['tests/setup-env.ts'],
    globalSetup: ['tests/global-setup.ts'],
    fileParallelism: false,
    testTimeout: 60000,
    hookTimeout: 120000,
    // The JSON report feeds the Phase 1 completion page: a requirement is shown as test-verified only if its test files
    // appear in the latest report and passed.
    reporters: ['default', 'json'],
    outputFile: { json: 'test-results/vitest.json' },
  },
})
