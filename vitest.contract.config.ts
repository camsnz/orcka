import { defineConfig } from "vitest/config";
import { alias } from "./vite.config";
import { vitestParallelism } from "./vitest.config";

export default defineConfig({
  resolve: {
    alias,
  },
  test: {
    ...vitestParallelism,
    // Coverage disabled for contract tests to avoid overwriting unit test coverage
    coverage: {
      enabled: false,
    },
    globals: true,
    environment: "node",
    include: ["src/contract/**/*.spec.ts"],
    setupFiles: ["src/test-utils/setup.ts"],
    reporters: [
      "verbose",
      [
        "junit",
        {
          outputFile: "etc/reports/tests/contract-test-results.xml",
        },
      ],
    ],
  },
});
