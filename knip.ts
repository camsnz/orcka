import type { KnipConfig } from "knip";

const config: KnipConfig = {
  project: ["src/**/*.{js,ts}", "cmd/**/*.ts"],
  ignoreDependencies: [
    "sql.js", // Used in session-tracker.ts via dynamic import
  ],
  ignore: [
    "cmd/health-check/session-tracker.ts", // Called via bash scripts
  ],
};

export default config;
