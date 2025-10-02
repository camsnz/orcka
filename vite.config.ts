import { resolve } from "path";
import { defineConfig } from "vite";

export const alias = {
  "@": resolve(__dirname, "./src"),
  "@/cli": resolve(__dirname, "./src/cli"),
  "@/core": resolve(__dirname, "./src/core"),
  "@/docker": resolve(__dirname, "./src/docker"),
  "@/generators": resolve(__dirname, "./src/generators"),
  "@/utils": resolve(__dirname, "./src/utils"),
  "@/types": resolve(__dirname, "./src/types"),
};

export default defineConfig({
  resolve: {
    alias: {
      ...alias,
      performance: "perf_hooks",
    },
  },
  build: {
    target: "node18",
    lib: {
      entry: resolve(__dirname, "src/orcka.ts"),
      name: "orcka",
      fileName: "orcka",
      formats: ["cjs"],
    },
    rollupOptions: {
      external: [
        "crypto",
        "fs",
        "path",
        "child_process",
        "minimist",
        "yaml",
        "node:crypto",
        "node:fs",
        "node:path",
        "node:child_process",
        "node:os",
        "util",
        "zlib",
        "stream",
        "assert",
        "constants",
        "perf_hooks",
        "@cdktf/hcl2json",
        "js-yaml",
      ],
      output: {
        format: "cjs",
        entryFileNames: "orcka.cjs",
      },
    },
    outDir: "bin",
    emptyOutDir: true,
    minify: false,
    sourcemap: false,
  },
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.spec.ts", "src/**/*.test.ts"],
  },
});
