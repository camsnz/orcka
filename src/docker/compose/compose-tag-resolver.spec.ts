import { beforeEach, describe, expect, it } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { stringify } from "yaml";
import {
  matchServicesToTargets,
  resolveComposeTags,
  resolveComposeTagsFromFile,
  type ComposeImageTag,
} from "./compose-tag-resolver";

describe("compose-tag-resolver", () => {
  const testDir = join(process.cwd(), "tmp", "compose-tag-resolver-test");

  beforeEach(() => {
    // Clean and recreate test directory
    rmSync(testDir, { recursive: true, force: true });
    mkdirSync(testDir, { recursive: true });
  });

  describe("resolveComposeTags", () => {
    it("should resolve static image tags", () => {
      const composeFile = join(testDir, "docker-compose.yml");
      writeFileSync(
        composeFile,
        stringify({
          services: {
            web: { image: "nginx:1.21" },
            api: { image: "node:16-alpine" },
          },
        })
      );

      const result = resolveComposeTags([composeFile]);

      expect(result.tags).toHaveLength(2);
      expect(result.tags[0]).toMatchObject({
        serviceName: "web",
        imageName: "nginx",
        tag: "1.21",
        originalTag: "1.21",
        hasVariables: false,
      });
      expect(result.tags[1]).toMatchObject({
        serviceName: "api",
        imageName: "node",
        tag: "16-alpine",
        originalTag: "16-alpine",
        hasVariables: false,
      });
      expect(result.warnings).toHaveLength(0);
    });

    it("should default to 'latest' when no tag specified", () => {
      const composeFile = join(testDir, "docker-compose.yml");
      writeFileSync(
        composeFile,
        stringify({
          services: {
            web: { image: "nginx" },
          },
        })
      );

      const result = resolveComposeTags([composeFile]);

      expect(result.tags[0]).toMatchObject({
        serviceName: "web",
        imageName: "nginx",
        tag: "latest",
        originalTag: "latest",
      });
    });

    it("should resolve environment variables with defaults", () => {
      const composeFile = join(testDir, "docker-compose.yml");
      writeFileSync(
        composeFile,
        stringify({
          services: {
            web: { image: "myapp:${VERSION-v1.0}" },
          },
        })
      );

      const result = resolveComposeTags([composeFile], {
        env: {}, // VERSION not set, should use default
      });

      expect(result.tags[0]).toMatchObject({
        serviceName: "web",
        imageName: "myapp",
        tag: "v1.0",
        originalTag: "${VERSION-v1.0}",
        hasVariables: true,
      });
    });

    it("should resolve environment variables from provided env", () => {
      const composeFile = join(testDir, "docker-compose.yml");
      writeFileSync(
        composeFile,
        stringify({
          services: {
            web: { image: "myapp:${VERSION-v1.0}" },
          },
        })
      );

      const result = resolveComposeTags([composeFile], {
        env: { VERSION: "v2.0" },
      });

      expect(result.tags[0]).toMatchObject({
        serviceName: "web",
        imageName: "myapp",
        tag: "v2.0",
        hasVariables: true,
      });
    });

    it("should handle colon-dash default syntax ${VAR:-default}", () => {
      const composeFile = join(testDir, "docker-compose.yml");
      writeFileSync(
        composeFile,
        stringify({
          services: {
            web: { image: "myapp:${VERSION:-latest}" },
          },
        })
      );

      const result = resolveComposeTags([composeFile]);

      expect(result.tags[0].tag).toBe("latest");
    });

    it("should handle registry with port numbers", () => {
      const composeFile = join(testDir, "docker-compose.yml");
      writeFileSync(
        composeFile,
        stringify({
          services: {
            web: { image: "localhost:5000/myapp:v1.0" },
          },
        })
      );

      const result = resolveComposeTags([composeFile]);

      expect(result.tags[0]).toMatchObject({
        serviceName: "web",
        imageName: "localhost:5000/myapp",
        tag: "v1.0",
      });
    });

    it("should handle fully qualified image names with registry", () => {
      const composeFile = join(testDir, "docker-compose.yml");
      writeFileSync(
        composeFile,
        stringify({
          services: {
            web: { image: "docker.io/library/nginx:alpine" },
          },
        })
      );

      const result = resolveComposeTags([composeFile]);

      expect(result.tags[0]).toMatchObject({
        serviceName: "web",
        imageName: "docker.io/library/nginx",
        tag: "alpine",
      });
    });

    it("should skip services without image field", () => {
      const composeFile = join(testDir, "docker-compose.yml");
      writeFileSync(
        composeFile,
        stringify({
          services: {
            web: { build: "." },
            api: { image: "node:16" },
          },
        })
      );

      const result = resolveComposeTags([composeFile]);

      expect(result.tags).toHaveLength(1);
      expect(result.tags[0].serviceName).toBe("api");
    });

    it("should merge multiple compose files", () => {
      const composeFile1 = join(testDir, "docker-compose.yml");
      const composeFile2 = join(testDir, "docker-compose.override.yml");

      writeFileSync(
        composeFile1,
        stringify({
          services: {
            web: { image: "nginx:1.20" },
            api: { image: "node:14" },
          },
        })
      );

      writeFileSync(
        composeFile2,
        stringify({
          services: {
            web: { image: "nginx:1.21" }, // Override
            db: { image: "postgres:13" }, // New service
          },
        })
      );

      const result = resolveComposeTags([composeFile1, composeFile2], {
        applyMerging: true,
      });

      expect(result.tags).toHaveLength(3);
      
      const webTag = result.tags.find(t => t.serviceName === "web");
      expect(webTag?.tag).toBe("1.21"); // Should use override value

      const apiTag = result.tags.find(t => t.serviceName === "api");
      expect(apiTag?.tag).toBe("14");

      const dbTag = result.tags.find(t => t.serviceName === "db");
      expect(dbTag?.tag).toBe("13");
    });

    it("should handle empty compose files array", () => {
      const result = resolveComposeTags([]);

      expect(result.tags).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it("should handle compose file without services", () => {
      const composeFile = join(testDir, "docker-compose.yml");
      writeFileSync(composeFile, stringify({ version: "3" }));

      const result = resolveComposeTags([composeFile]);

      expect(result.tags).toHaveLength(0);
      expect(result.warnings).toContain("No services found in compose files");
    });

    it("should handle malformed compose file", () => {
      const composeFile = join(testDir, "docker-compose.yml");
      writeFileSync(composeFile, "invalid: yaml: content: [");

      const result = resolveComposeTags([composeFile]);

      expect(result.tags).toHaveLength(0);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it("should handle missing compose file", () => {
      const composeFile = join(testDir, "nonexistent.yml");

      const result = resolveComposeTags([composeFile]);

      expect(result.tags).toHaveLength(0);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it("should handle complex tag with dashes and dots", () => {
      const composeFile = join(testDir, "docker-compose.yml");
      writeFileSync(
        composeFile,
        stringify({
          services: {
            web: { image: "myapp:v1.2.3-beta.1" },
          },
        })
      );

      const result = resolveComposeTags([composeFile]);

      expect(result.tags[0].tag).toBe("v1.2.3-beta.1");
    });

    it("should preserve original tag when variables are used", () => {
      const composeFile = join(testDir, "docker-compose.yml");
      writeFileSync(
        composeFile,
        stringify({
          services: {
            web: { image: "myapp:${TAG-latest}" },
          },
        })
      );

      const result = resolveComposeTags([composeFile]);

      expect(result.tags[0].tag).toBe("latest"); // Resolved
      expect(result.tags[0].originalTag).toBe("${TAG-latest}"); // Original preserved
    });
  });

  describe("resolveComposeTagsFromFile", () => {
    it("should resolve tags from a single file", () => {
      const composeFile = join(testDir, "docker-compose.yml");
      writeFileSync(
        composeFile,
        stringify({
          services: {
            web: { image: "nginx:latest" },
          },
        })
      );

      const result = resolveComposeTagsFromFile(composeFile);

      expect(result.tags).toHaveLength(1);
      expect(result.tags[0].serviceName).toBe("web");
    });

    it("should accept custom env variables", () => {
      const composeFile = join(testDir, "docker-compose.yml");
      writeFileSync(
        composeFile,
        stringify({
          services: {
            web: { image: "myapp:${VERSION}" },
          },
        })
      );

      const result = resolveComposeTagsFromFile(composeFile, { VERSION: "v3.0" });

      expect(result.tags[0].tag).toBe("v3.0");
    });
  });

  describe("matchServicesToTargets", () => {
    it("should match services by exact name", () => {
      const composeTags: ComposeImageTag[] = [
        {
          serviceName: "web",
          imageName: "nginx",
          tag: "latest",
          originalTag: "latest",
          hasVariables: false,
        },
      ];

      const bakeTargets = {
        web: { tags: ["nginx:latest"] },
        api: { tags: ["node:16"] },
      };

      const matches = matchServicesToTargets(composeTags, bakeTargets);

      expect(matches.get("web")).toBe("web");
    });

    it("should match services with normalized names (dash to underscore)", () => {
      const composeTags: ComposeImageTag[] = [
        {
          serviceName: "api-gateway",
          imageName: "gateway",
          tag: "v1",
          originalTag: "v1",
          hasVariables: false,
        },
      ];

      const bakeTargets = {
        api_gateway: { tags: ["gateway:v1"] },
      };

      const matches = matchServicesToTargets(composeTags, bakeTargets);

      expect(matches.get("api-gateway")).toBe("api_gateway");
    });

    it("should match services by image name", () => {
      const composeTags: ComposeImageTag[] = [
        {
          serviceName: "frontend",
          imageName: "mycompany/web-ui",
          tag: "latest",
          originalTag: "latest",
          hasVariables: false,
        },
      ];

      const bakeTargets = {
        "web-ui": { tags: ["mycompany/web-ui:latest"] },
      };

      const matches = matchServicesToTargets(composeTags, bakeTargets);

      expect(matches.get("frontend")).toBe("web-ui");
    });

    it("should handle services that don't match any targets", () => {
      const composeTags: ComposeImageTag[] = [
        {
          serviceName: "unknown",
          imageName: "someimage",
          tag: "latest",
          originalTag: "latest",
          hasVariables: false,
        },
      ];

      const bakeTargets = {
        web: { tags: ["nginx:latest"] },
      };

      const matches = matchServicesToTargets(composeTags, bakeTargets);

      expect(matches.has("unknown")).toBe(false);
    });

    it("should handle bake targets without tags", () => {
      const composeTags: ComposeImageTag[] = [
        {
          serviceName: "web",
          imageName: "nginx",
          tag: "latest",
          originalTag: "latest",
          hasVariables: false,
        },
      ];

      const bakeTargets = {
        web: { context: "." }, // No tags field
      };

      const matches = matchServicesToTargets(composeTags, bakeTargets);

      expect(matches.get("web")).toBe("web"); // Still matches by name
    });

    it("should prefer exact match over normalized match", () => {
      const composeTags: ComposeImageTag[] = [
        {
          serviceName: "api-gateway",
          imageName: "gateway",
          tag: "v1",
          originalTag: "v1",
          hasVariables: false,
        },
      ];

      const bakeTargets = {
        "api-gateway": { tags: ["gateway:v1"] }, // Exact match
        api_gateway: { tags: ["gateway:v2"] }, // Normalized match
      };

      const matches = matchServicesToTargets(composeTags, bakeTargets);

      expect(matches.get("api-gateway")).toBe("api-gateway"); // Should prefer exact
    });
  });
});

