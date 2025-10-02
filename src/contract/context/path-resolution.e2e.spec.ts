import { execSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createPersistentContextWorkspace, orckaBin } from "../helpers/context-test-env";

describe("orcka.yml context handling", () => {
  const workspace = createPersistentContextWorkspace("context-path-test");
  const testDir = workspace.path;

  beforeEach(() => {
    workspace.prepare();
  });

  afterEach(() => {
    workspace.cleanup();
  });

  describe("path resolution behavior", () => {
    it("should document new context behavior", () => {
      mkdirSync(join(testDir, "project", "build", "web"), { recursive: true });

      const dockerShaYml = `
project:
  name: path-test
  context: ./build
  write: output.hcl
  bake:
    - docker-bake.hcl

targets:
  web:
    calculate_on:
      files:
        - web/app.js
`;

      writeFileSync(join(testDir, "project", "orcka.yml"), dockerShaYml);
      writeFileSync(
        join(testDir, "project", "build", "docker-bake.hcl"),
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
      writeFileSync(join(testDir, "project", "build", "web", "Dockerfile"), "FROM node:18");
      writeFileSync(join(testDir, "project", "build", "web", "app.js"), "console.log('web');");

      const result = execSync(`node ${orckaBin} stat --file orcka.yml`, {
        cwd: join(testDir, "project"),
        encoding: "utf8",
      });

      expect(result).toContain("✅ Calculating targets:");
      expect(result).toContain("✅ Would write files:");
      expect(result).toContain("  • build/.orcka/output.hcl");

      const outputPath = join(testDir, "project", "build", ".orcka", "output.hcl");
      expect(existsSync(outputPath)).toBe(false);

      expect(result).toMatch(/WEB_TAG_VER = "[a-f0-9_]+"/);
    }, 20000);
  });
});
