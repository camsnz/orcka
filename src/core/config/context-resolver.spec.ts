import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { DockerBakeConfig, DockerShaConfig } from "../../types.js";
import { ContextResolver } from "./context-resolver";

describe("ContextResolver", () => {
  const testDir = "/tmp/context-resolver-test";
  const dockerShaPath = join(testDir, "docker-sha.yml");

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
    mkdirSync(join(testDir, "subdir"), { recursive: true });
    mkdirSync(join(testDir, "app"), { recursive: true });
    mkdirSync(join(testDir, "api"), { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  describe("getOrckaContext", () => {
    it("should use docker-sha.yml directory when project.context is not specified", () => {
      const config: DockerShaConfig = {
        project: { name: "test", write: "output.hcl", bake: [] },
        targets: {},
      };

      const resolver = new ContextResolver(dockerShaPath, config);
      expect(resolver.getOrckaContext()).toBe(testDir);
    });

    it("should resolve project.context relative to docker-sha.yml directory", () => {
      const config: DockerShaConfig = {
        project: {
          name: "test",
          context: "subdir",
          write: "output.hcl",
          bake: [],
        },
        targets: {},
      };

      const resolver = new ContextResolver(dockerShaPath, config);
      expect(resolver.getOrckaContext()).toBe(join(testDir, "subdir"));
    });
  });

  describe("resolveTargetContext", () => {
    let resolver: ContextResolver;
    let config: DockerShaConfig;
    let bakeConfigs: Map<string, DockerBakeConfig>;

    beforeEach(() => {
      config = {
        project: {
          name: "test",
          write: "output.hcl",
          bake: ["docker-bake.hcl"],
        },
        targets: {},
      };

      bakeConfigs = new Map();
      bakeConfigs.set("docker-bake.hcl", {
        target: {
          web: {
            dockerfile: "app/Dockerfile",
            context: "app",
          },
          api: {
            dockerfile: "api/Dockerfile",
          },
        },
      });

      resolver = new ContextResolver(dockerShaPath, config);
      resolver.setBakeConfigs(bakeConfigs);
    });

    it("should default to orcka context when context_of is not specified", () => {
      const target = { calculate_on: { always: true } };
      const context = resolver.resolveTargetContext("web", target);
      expect(context).toBe(testDir);
    });

    it("should use orcka context when context_of is 'orcka'", () => {
      const target = {
        calculate_on: { always: true },
        context_of: "orcka" as const,
      };
      const context = resolver.resolveTargetContext("web", target);
      expect(context).toBe(testDir);
    });

    it("should resolve dockerfile context when context_of is 'dockerfile'", () => {
      const target = {
        calculate_on: { always: true },
        context_of: "dockerfile" as const,
      };
      const context = resolver.resolveTargetContext("web", target);
      expect(context).toBe(join(testDir, "app")); // Directory containing app/Dockerfile
    });

    it("should resolve bake target context when context_of is 'target'", () => {
      const target = {
        calculate_on: { always: true },
        context_of: "target" as const,
      };
      const context = resolver.resolveTargetContext("web", target);
      expect(context).toBe(join(testDir, "app")); // Bake target's context
    });

    it("should resolve bake file context when context_of is 'bake'", () => {
      const target = {
        calculate_on: { always: true },
        context_of: "bake" as const,
      };
      const context = resolver.resolveTargetContext("web", target);
      expect(context).toBe(testDir); // Directory containing docker-bake.hcl
    });

    it("should fallback to orcka context when dockerfile is not found", () => {
      const target = {
        calculate_on: { always: true },
        context_of: "dockerfile" as const,
      };
      const context = resolver.resolveTargetContext("nonexistent", target);
      expect(context).toBe(testDir);
    });

    it("should fallback to orcka context when bake target context is not specified", () => {
      const target = {
        calculate_on: { always: true },
        context_of: "target" as const,
      };
      const context = resolver.resolveTargetContext("api", target); // api target has no context
      expect(context).toBe(testDir);
    });
  });

  describe("resolveFilePath", () => {
    it("should resolve file paths relative to target context", () => {
      const config: DockerShaConfig = {
        project: {
          name: "test",
          write: "output.hcl",
          bake: ["docker-bake.hcl"],
        },
        targets: {},
      };

      const bakeConfigs = new Map();
      bakeConfigs.set("docker-bake.hcl", {
        target: {
          web: {
            dockerfile: "app/Dockerfile",
            context: "app",
          },
        },
      });

      const resolver = new ContextResolver(dockerShaPath, config);
      resolver.setBakeConfigs(bakeConfigs);

      const target = {
        calculate_on: { files: ["src/index.js"] },
        context_of: "target" as const,
      };

      const filePath = resolver.resolveFilePath("web", target, "src/index.js");
      expect(filePath).toBe(join(testDir, "app", "src/index.js"));
    });
  });
});
