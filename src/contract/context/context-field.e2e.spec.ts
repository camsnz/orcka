import { execSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createPersistentContextWorkspace, orckaBin } from "../helpers/context-test-env";

describe("orcka.yml context handling", () => {
  const workspace = createPersistentContextWorkspace("context-field-test");
  const testDir = workspace.path;

  beforeEach(() => {
    workspace.prepare();
  });

  afterEach(() => {
    workspace.cleanup();
  });

  describe("context field behavior", () => {
    it("should honor context for write file path resolution", () => {
      mkdirSync(join(testDir, "config", "build", "web"), { recursive: true });

      const dockerShaYml = `
project:
  name: context-test
  context: ./build
  write: docker-sha.hcl
  bake:
    - docker-bake.hcl

targets:
  web:
    calculate_on:
      files:
        - web/app.js
`;

      const dockerBakeHcl = `
variable "WEB_TAG_VER" {
  default = ""
}

target "web" {
  dockerfile = "web/Dockerfile"
  tags = ["web:latest"]
}
`;

      writeFileSync(join(testDir, "config", "orcka.yml"), dockerShaYml);
      writeFileSync(join(testDir, "config", "build", "docker-bake.hcl"), dockerBakeHcl);
      writeFileSync(join(testDir, "config", "build", "web", "Dockerfile"), "FROM node:18");
      writeFileSync(join(testDir, "config", "build", "web", "app.js"), "console.log('web');");

      const result = execSync(`node ${orckaBin} stat --file orcka.yml`, {
        cwd: join(testDir, "config"),
        encoding: "utf8",
      });

      expect(result).toContain("✅ Calculating targets:");
      expect(result).toContain("✅ Would write files:");
      expect(result).toContain("  • build/.orcka/docker-sha.hcl");
      expect(result).toMatch(/WEB_TAG_VER = "[a-f0-9_]+"/);

      const outputFile = join(testDir, "config", "build", ".orcka", "docker-sha.hcl");
      expect(existsSync(outputFile)).toBe(false);
    }, 20000);

    it("should fail when bake file is not found relative to context", () => {
      mkdirSync(join(testDir, "config"), { recursive: true });
      mkdirSync(join(testDir, "build"), { recursive: true });

      const dockerShaYml = `
project:
  name: context-test
  context: ./build
  write: docker-sha.hcl
  bake:
    - docker-bake.hcl

targets:
  web:
    calculate_on:
      files:
        - web/app.js
`;

      writeFileSync(join(testDir, "config", "orcka.yml"), dockerShaYml);
      writeFileSync(
        join(testDir, "config", "docker-bake.hcl"),
        `
variable "WEB_TAG_VER" {
  default = ""
}

target "web" {
  dockerfile = "web/Dockerfile"
  tags = ["web:latest"]
}
`,
      );

      expect(() => {
        execSync(`node ${orckaBin} stat --file orcka.yml`, {
          cwd: join(testDir, "config"),
          encoding: "utf8",
        });
      }).toThrow();
    });

    it("should resolve bake files relative to context directory (new behavior)", () => {
      mkdirSync(join(testDir, "config", "build", "web"), { recursive: true });

      const dockerShaYml = `
project:
  name: context-test
  context: ./build
  write: docker-sha.hcl
  bake:
    - docker-bake.hcl

targets:
  web:
    calculate_on:
      files:
        - web/app.js
`;

      const dockerBakeHcl = `
variable "WEB_TAG_VER" {
  default = ""
}

target "web" {
  dockerfile = "web/Dockerfile"
  tags = ["web:latest"]
}
`;

      writeFileSync(join(testDir, "config", "orcka.yml"), dockerShaYml);
      writeFileSync(join(testDir, "config", "build", "docker-bake.hcl"), dockerBakeHcl);
      writeFileSync(join(testDir, "config", "build", "web", "Dockerfile"), "FROM node:18");
      writeFileSync(join(testDir, "config", "build", "web", "app.js"), "console.log('web');");

      const result = execSync(`node ${orckaBin} stat --file orcka.yml`, {
        cwd: join(testDir, "config"),
        encoding: "utf8",
      });

      expect(result).toContain("✅ Calculating targets:");
      expect(result).toContain("✅ Would write files:");
      expect(result).toContain("  • build/.orcka/docker-sha.hcl");

      const outputFile = join(testDir, "config", "build", ".orcka", "docker-sha.hcl");
      expect(existsSync(outputFile)).toBe(false);
    }, 20000);
  });
});
