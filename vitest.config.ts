import { defineConfig } from "vitest/config";
import tsconfig from "./tsconfig.json";
import { alias } from "./vite.config";

export const vitestParallelism = {
  pool: "threads",
  poolOptions: {
    threads: {
      maxThreads: 4, // 4 is enough
      minThreads: 1,
    },
  },
} as const;

export default defineConfig({
  resolve: {
    alias,
  },
  test: {
    ...vitestParallelism,
    coverage: {
      provider: "istanbul",
      reporter: ["text", "text-summary", "json", "json-summary", "html"],
      reportOnFailure: true,
      enabled: false,
      clean: true,
      reportsDirectory: "etc/reports/coverage",
      include: ["src/**/*.ts"],
      exclude: [
        ...tsconfig.exclude,
        "bin/**",
        "cmd/**",
        "doc/**",
        "etc/**",
        "src/**/*.spec.ts",
        "src/**/*.test.ts",
        "src/test-utils/**",
        "src/contract/**",
        "src/generators/reports/**",
        "src/types.ts",
        "node_modules/**",
      ],
      all: true,
      skipFull: false,
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
    },
    globals: true,
    environment: "node",
    include: ["src/**/*.spec.ts"],
    exclude: ["src/contract/**/*.spec.ts"],
    setupFiles: ["src/test-utils/setup.ts"],
    reporters: [
      "verbose",
      [
        "junit",
        {
          outputFile: "etc/reports/tests/test-results.xml",
        },
      ],
    ],
  },
});
