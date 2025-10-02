import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createPersistentContextWorkspace, orckaBin } from "../helpers/context-test-env";

describe("orcka.yml context handling", () => {
  const workspace = createPersistentContextWorkspace("context-syntax-test");
  const testDir = workspace.path;

  beforeEach(() => {
    workspace.prepare();
  });

  afterEach(() => {
    workspace.cleanup();
  });

  describe("orcka.yml syntax validation", () => {
    it("should validate required project fields", () => {
      const testCases = [
        {
          name: "missing name field",
          config: `
project:
  context: .
  write: output.hcl
  bake: ["docker-bake.hcl"]
targets: {}
`,
          expectedError: "name",
        },
        {
          name: "missing write field",
          config: `
project:
  name: test
  context: .
  bake: ["docker-bake.hcl"]
targets: {}
`,
          expectedError: "write",
        },
        {
          name: "missing bake field",
          config: `
project:
  name: test
  context: .
  write: output.hcl
targets: {}
`,
          expectedError: "bake",
        },
      ];

      for (const testCase of testCases) {
        writeFileSync(join(testDir, "orcka.yml"), testCase.config);

        try {
          execSync(`node ${orckaBin} stat --file orcka.yml`, {
            cwd: testDir,
            encoding: "utf8",
          });
          throw new Error(`Expected validation to fail for ${testCase.name}`);
        } catch (error: unknown) {
          const execError = error as { stdout?: string; message?: string };
          expect(execError.stdout || execError.message).toContain(testCase.expectedError);
        }
      }
    });

    it("should validate project field types", () => {
      const testCases = [
        {
          name: "name as number",
          config: `
project:
  name: 123
  context: .
  write: output.hcl
  bake: ["docker-bake.hcl"]
targets: {}
`,
        },
        {
          name: "context as array",
          config: `
project:
  name: test
  context: ["."]
  write: output.hcl
  bake: ["docker-bake.hcl"]
targets: {}
`,
        },
        {
          name: "write as object",
          config: `
project:
  name: test
  context: .
  write: {file: "output.hcl"}
  bake: ["docker-bake.hcl"]
targets: {}
`,
        },
        {
          name: "bake as string",
          config: `
project:
  name: test
  context: .
  write: output.hcl
  bake: "docker-bake.hcl"
targets: {}
`,
        },
      ];

      for (const testCase of testCases) {
        writeFileSync(join(testDir, "orcka.yml"), testCase.config);

        expect(() => {
          execSync(`node ${orckaBin} stat --file orcka.yml`, {
            cwd: testDir,
            encoding: "utf8",
          });
        }).toThrow(Error);
      }
    });

    it("should validate target structure", () => {
      const testCases = [
        {
          name: "target as string instead of object",
          config: `
project:
  name: test
  context: .
  write: output.hcl
  bake: ["docker-bake.hcl"]
targets:
  web: "invalid"
`,
        },
        {
          name: "invalid calculate_on structure",
          config: `
project:
  name: test
  context: .
  write: output.hcl
  bake: ["docker-bake.hcl"]
targets:
  web:
    calculate_on: "invalid"
`,
        },
        {
          name: "invalid period unit",
          config: `
project:
  name: test
  context: .
  write: output.hcl
  bake: ["docker-bake.hcl"]
targets:
  web:
    calculate_on:
      period:
        unit: "invalid-unit"
        number: 1
`,
        },
        {
          name: "negative period number",
          config: `
project:
  name: test
  context: .
  write: output.hcl
  bake: ["docker-bake.hcl"]
targets:
  web:
    calculate_on:
      period:
        unit: "days"
        number: -1
`,
        },
      ];

      for (const testCase of testCases) {
        writeFileSync(join(testDir, "orcka.yml"), testCase.config);

        expect(() => {
          execSync(`node ${orckaBin} stat --file orcka.yml`, {
            cwd: testDir,
            encoding: "utf8",
          });
        }).toThrow(Error);
      }
    });

    it("should accept valid configurations", () => {
      const validConfigs = [
        {
          name: "minimal valid config",
          config: `
project:
  name: test
  context: .
  write: output.hcl
  bake: ["docker-bake.hcl"]
targets: {}
`,
        },
        {
          name: "config with empty target",
          config: `
project:
  name: test
  context: .
  write: output.hcl
  bake: ["docker-bake.hcl"]
targets:
  web: {}
`,
        },
        {
          name: "config with all calculate_on options",
          config: `
project:
  name: test
  context: .
  write: output.hcl
  bake: ["docker-bake.hcl"]
targets:
  web:
    calculate_on:
      files: ["src/app.js"]
      period:
        unit: "days"
        number: 7
      jq:
        filename: "package.json"
        selector: ".dependencies"
`,
        },
        {
          name: "config with multiple bake files",
          config: `
project:
  name: test
  context: .
  write: output.hcl
  bake:
    - "docker-bake.hcl"
    - "docker-bake-prod.hcl"
targets:
  web:
    calculate_on:
      files: ["src/app.js"]
`,
        },
      ];

      for (const testCase of validConfigs) {
        writeFileSync(join(testDir, "orcka.yml"), testCase.config);
        writeFileSync(
          join(testDir, "docker-bake.hcl"),
          'variable "WEB_TAG_VER" { default = "" }\ntarget "web" { dockerfile = "Dockerfile" }',
        );
        if (testCase.config.includes("docker-bake-prod.hcl")) {
          writeFileSync(
            join(testDir, "docker-bake-prod.hcl"),
            'variable "API_TAG_VER" { default = "" }\ntarget "api" { dockerfile = "Dockerfile" }',
          );
        }
        if (testCase.config.includes("src/app.js")) {
          mkdirSync(join(testDir, "src"), { recursive: true });
          writeFileSync(join(testDir, "src", "app.js"), "console.log('test');");
        }
        if (testCase.config.includes("package.json")) {
          writeFileSync(join(testDir, "package.json"), '{"name": "test"}');
        }

        const result = execSync(`node ${orckaBin} stat --file orcka.yml`, {
          cwd: testDir,
          encoding: "utf8",
        });

        expect(result).toContain("✅ Would write files:");
      }
    }, 60000);
  });
});
