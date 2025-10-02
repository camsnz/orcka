import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createEphemeralContextWorkspace, orckaBin } from "../helpers/context-test-env";

describe("orcka.yml context handling", () => {
  describe("context_of field behavior", () => {
    it("should validate context_of field values", () => {
      const workspace = createEphemeralContextWorkspace("orcka-context-of");

      try {
        const invalidConfig = `
project:
  name: test
  write: output.hcl
  bake: ["docker-bake.hcl"]
targets:
  web:
    calculate_on:
      files: ["src/app.js"]
    context_of: "invalid"
`;

        writeFileSync(join(workspace.path, "orcka.yml"), invalidConfig);
        writeFileSync(
          join(workspace.path, "docker-bake.hcl"),
          `
variable "WEB_TAG_VER" {
  default = ""
}

target "web" {
  dockerfile = "Dockerfile"
  context = "."
}
`,
        );

        expect(() => {
          execSync(`node ${orckaBin} stat --file orcka.yml`, {
            cwd: workspace.path,
            encoding: "utf8",
          });
        }).toThrow();
      } finally {
        workspace.cleanup();
      }
    });

    it("should accept valid context_of values", () => {
      const workspace = createEphemeralContextWorkspace("orcka-context-of");

      try {
        mkdirSync(join(workspace.path, "src"));
        writeFileSync(join(workspace.path, "src", "app.js"), "console.log('test');");
        writeFileSync(join(workspace.path, "Dockerfile"), "FROM node:18");

        const validConfigs = [
          { context_of: "orcka" },
          { context_of: "dockerfile" },
          { context_of: "target" },
          { context_of: "bake" },
        ];

        for (const { context_of } of validConfigs) {
          const config = `
project:
  name: test
  write: output.hcl
  bake: ["docker-bake.hcl"]
targets:
  web:
    calculate_on:
      files: ["src/app.js"]
    context_of: "${context_of}"
`;

          writeFileSync(join(workspace.path, "orcka.yml"), config);
          writeFileSync(
            join(workspace.path, "docker-bake.hcl"),
            `
variable "WEB_TAG_VER" {
  default = ""
}

target "web" {
  dockerfile = "Dockerfile"
  context = "."
}
`,
          );

          const result = execSync(`node ${orckaBin} stat --file orcka.yml`, {
            cwd: workspace.path,
            encoding: "utf8",
          });

          expect(result).toContain("✅ Would write files:");
        }
      } finally {
        workspace.cleanup();
      }
    }, 60000);

    it("should resolve file paths based on context_of setting", () => {
      const workspace = createEphemeralContextWorkspace("orcka-context-of");

      try {
        mkdirSync(join(workspace.path, "app", "src"), { recursive: true });
        writeFileSync(join(workspace.path, "app", "src", "index.js"), "console.log('app');");
        writeFileSync(join(workspace.path, "app", "Dockerfile"), "FROM node:18");

        const config = `
project:
  name: test
  write: output.hcl
  bake: ["docker-bake.hcl"]
targets:
  web:
    calculate_on:
      files: ["src/index.js"]
    context_of: "target"
`;

        writeFileSync(join(workspace.path, "orcka.yml"), config);
        writeFileSync(
          join(workspace.path, "docker-bake.hcl"),
          `
variable "WEB_TAG_VER" {
  default = ""
}

target "web" {
  dockerfile = "app/Dockerfile"
  context = "app"
}
`,
        );

        const result = execSync(`node ${orckaBin} stat --file orcka.yml`, {
          cwd: workspace.path,
          encoding: "utf8",
        });

        expect(result).toContain("✅ Would write files:");
      } finally {
        workspace.cleanup();
      }
    }, 60000);
  });
});
