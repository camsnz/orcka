import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { DockerShaConfig } from "@/types.js";
import { buildVerboseReport } from "./verbose-report-builder.js";

describe("verbose-report-builder", () => {
  const workspaces: string[] = [];

  afterEach(() => {
    for (const workspace of workspaces.splice(0, workspaces.length)) {
      rmSync(workspace, { recursive: true, force: true });
    }
  });

  it("builds verbose configuration info with file statuses", async () => {
    const workspace = mkdtempSync(join(tmpdir(), "verbose-report-"));
    workspaces.push(workspace);

    const projectDir = join(workspace, "project");
    const appDir = join(projectDir, "app");
    const srcDir = join(appDir, "src");
    mkdirSync(srcDir, { recursive: true });

    const dockerShaFilePath = join(workspace, "docker-sha.yml");
    writeFileSync(dockerShaFilePath, "orcka: true");

    const bakeFilePath = join(workspace, "docker-bake.hcl");
    writeFileSync(
      bakeFilePath,
      `
variable "WEB_TAG_VER" {
  default = ""
}

target "web" {
  context    = "project/app"
  dockerfile = "Dockerfile"
}
`,
    );

    const orckaDir = join(projectDir, ".orcka");
    mkdirSync(orckaDir, { recursive: true });
    writeFileSync(join(orckaDir, "docker-sha.hcl"), "");
    writeFileSync(join(appDir, "Dockerfile"), "FROM scratch");
    writeFileSync(join(srcDir, "app.js"), "console.log('ok');");

    const config: DockerShaConfig = {
      project: {
        context: "project",
        write: "docker-sha.hcl",
        bake: ["../docker-bake.hcl"],
      },
      targets: {
        web: {
          context_of: "target",
          calculate_on: {
            files: ["src/app.js", "src/missing.js"],
            jq: {
              filename: "package.json",
              selector: ".dependencies",
            },
          },
        },
      },
    } as DockerShaConfig;

    const report = await buildVerboseReport({
      dockerShaFilePath,
      config,
    });

    expect(report.dockerShaFile).toBe(dockerShaFilePath);
    expect(report.projectContext).toBe(projectDir);
    expect(report.bakeFiles).toEqual([{ path: bakeFilePath, exists: true }]);
    expect(report.outputFile).toEqual({
      path: join(projectDir, ".orcka", "docker-sha.hcl"),
      exists: true,
    });

    expect(report.targets).toHaveLength(1);
    const target = report.targets[0];
    expect(target.name).toBe("web");
    expect(target.contextOf).toBe("target");
    expect(target.resolvedContext).toBe(appDir);
    expect(target.bakeFile).toEqual({ path: bakeFilePath, exists: true });
    expect(target.dockerfile).toEqual({
      path: join(appDir, "Dockerfile"),
      exists: true,
    });
    expect(target.files).toEqual([
      { path: join(appDir, "src", "app.js"), exists: true },
      { path: join(appDir, "src", "missing.js"), exists: false },
    ]);
    expect(target.jqFiles).toEqual([
      {
        file: { path: join(appDir, "package.json"), exists: false },
        selector: ".dependencies",
      },
    ]);
  });
});
