import { describe, expect, it } from "vitest";
import type { VerboseConfigInfo } from "@/core/reports/verbose-report-builder.js";
import { VerboseFormatter } from "./verbose-formatter.js";

describe("VerboseFormatter", () => {
  it("formats verbose output with file status indicators", () => {
    const formatter = new VerboseFormatter("/workspace/docker-sha.yml");

    const configInfo: VerboseConfigInfo = {
      dockerShaFile: "/workspace/docker-sha.yml",
      projectContext: "/workspace/project",
      bakeFiles: [
        { path: "/workspace/docker-bake.hcl", exists: true },
        { path: "/workspace/missing-bake.hcl", exists: false },
      ],
      outputFile: { path: "/workspace/project/docker-sha.hcl", exists: false },
      targets: [
        {
          name: "web",
          contextOf: "target",
          resolvedContext: "/workspace/project/app",
          bakeFile: { path: "/workspace/docker-bake.hcl", exists: true },
          bakeTarget: "web",
          dockerfile: {
            path: "/workspace/project/app/Dockerfile",
            exists: true,
          },
          files: [
            { path: "/workspace/project/app/src/app.js", exists: true },
            { path: "/workspace/project/app/src/missing.js", exists: false },
          ],
          jqFiles: [
            {
              file: {
                path: "/workspace/project/app/package.json",
                exists: false,
              },
              selector: ".dependencies",
            },
          ],
        },
      ],
    };

    const output = formatter.formatOutput(configInfo);

    expect(output).toContain("📋 Docker SHA Configuration Analysis");
    expect(output).toContain("✓ /workspace/docker-bake.hcl");
    expect(output).toContain("✗ /workspace/missing-bake.hcl");
    expect(output).toContain("📦 web");
    expect(output).toContain("✓ /workspace/project/app/src/app.js");
    expect(output).toContain("✗ /workspace/project/app/src/missing.js");
    expect(output).toContain("selector: .dependencies");
  });
});
