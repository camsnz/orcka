import { readFileSync, writeFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parse, stringify } from "yaml";
import { modifyDockerCompose } from "./docker-compose-modifier.js";

// Mock fs functions
vi.mock("node:fs", () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

// Mock yaml functions
vi.mock("yaml", () => ({
  parse: vi.fn(),
  stringify: vi.fn(),
}));

const mockReadFileSync = vi.mocked(readFileSync);
const mockWriteFileSync = vi.mocked(writeFileSync);
const mockParse = vi.mocked(parse);
const mockStringify = vi.mocked(stringify);

// Mock logger
const mockLogger = {
  verbose: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  success: vi.fn(),
  logServiceSummary: vi.fn(),
  logServiceProcessing: vi.fn(),
  updateOptions: vi.fn(),
} as any;

describe("docker-compose-modifier", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("modifyDockerCompose", () => {
    it("should successfully modify docker-compose file with static image tags", async () => {
      const mockConfig = {
        version: "3.8",
        services: {
          web: {
            image: "nginx:1.21",
            ports: ["80:80"],
          },
          api: {
            image: "node:16-alpine",
            environment: ["NODE_ENV=production"],
          },
        },
      };

      const expectedModifiedConfig = {
        version: "3.8",
        services: {
          web: {
            image: "nginx:${WEB_TAG_VER-1.21}",
            ports: ["80:80"],
            pull_policy: "${WEB_PULL_POLICY-missing}",
          },
          api: {
            image: "node:${API_TAG_VER-16-alpine}",
            environment: ["NODE_ENV=production"],
            pull_policy: "${API_PULL_POLICY-missing}",
          },
        },
      };

      mockReadFileSync.mockReturnValue("mock file content");
      mockParse.mockReturnValue(mockConfig);
      mockStringify.mockReturnValue("modified content");

      const result = await modifyDockerCompose("/test/docker-compose.yml", mockLogger);

      expect(result.success).toBe(true);
      expect(result.modifiedServices).toEqual(["web", "api"]);
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);

      expect(mockReadFileSync).toHaveBeenCalledWith("/test/docker-compose.yml", "utf-8");
      expect(mockParse).toHaveBeenCalledWith("mock file content");
      expect(mockStringify).toHaveBeenCalledWith(expectedModifiedConfig, {
        indent: 2,
        lineWidth: -1,
      });
      expect(mockWriteFileSync).toHaveBeenCalledWith("/test/docker-compose.yml", "modified content", "utf-8");
    });

    it("should handle services without image field", async () => {
      const mockConfig = {
        version: "3.8",
        services: {
          database: {
            volumes: ["db-data:/var/lib/mysql"],
          },
          web: {
            image: "nginx:1.21",
          },
        },
      };

      mockReadFileSync.mockReturnValue("mock file content");
      mockParse.mockReturnValue(mockConfig);
      mockStringify.mockReturnValue("modified content");

      const result = await modifyDockerCompose("/test/docker-compose.yml", mockLogger);

      expect(result.success).toBe(true);
      expect(result.modifiedServices).toEqual(["web"]);
      expect(mockLogger.verbose).toHaveBeenCalledWith("Processing service: database");
      expect(mockLogger.verbose).toHaveBeenCalledWith("Processing service: web");
    });

    it("should skip images that already use variables but still add pull_policy", async () => {
      const mockConfig = {
        version: "3.8",
        services: {
          web: {
            image: "nginx:${TAG_VERSION}",
          },
          api: {
            image: "node:$NODE_VERSION",
          },
        },
      };

      mockReadFileSync.mockReturnValue("mock file content");
      mockParse.mockReturnValue(mockConfig);
      mockStringify.mockReturnValue("modified content");

      const result = await modifyDockerCompose("/test/docker-compose.yml", mockLogger);

      expect(result.success).toBe(true);
      expect(result.modifiedServices).toEqual(["web", "api"]);
      expect(mockLogger.verbose).toHaveBeenCalledWith("Skipping web: image already uses variables");
      expect(mockLogger.verbose).toHaveBeenCalledWith("Skipping api: image already uses variables");
      expect(mockLogger.verbose).toHaveBeenCalledWith("Added web: pull_policy = ${WEB_PULL_POLICY-missing}");
      expect(mockLogger.verbose).toHaveBeenCalledWith("Added api: pull_policy = ${API_PULL_POLICY-missing}");
    });

    it("should skip images without tags but still add pull_policy", async () => {
      const mockConfig = {
        version: "3.8",
        services: {
          web: {
            image: "nginx",
          },
        },
      };

      mockReadFileSync.mockReturnValue("mock file content");
      mockParse.mockReturnValue(mockConfig);
      mockStringify.mockReturnValue("modified content");

      const result = await modifyDockerCompose("/test/docker-compose.yml", mockLogger);

      expect(result.success).toBe(true);
      expect(result.modifiedServices).toEqual(["web"]);
      expect(mockLogger.verbose).toHaveBeenCalledWith("Skipping web: no tag specified in image");
      expect(mockLogger.verbose).toHaveBeenCalledWith("Added web: pull_policy = ${WEB_PULL_POLICY-missing}");
    });

    it("should skip images with port numbers as tags but still add pull_policy", async () => {
      const mockConfig = {
        version: "3.8",
        services: {
          database: {
            image: "postgres:5432",
          },
        },
      };

      mockReadFileSync.mockReturnValue("mock file content");
      mockParse.mockReturnValue(mockConfig);
      mockStringify.mockReturnValue("modified content");

      const result = await modifyDockerCompose("/test/docker-compose.yml", mockLogger);

      expect(result.success).toBe(true);
      expect(result.modifiedServices).toEqual(["database"]);
      expect(mockLogger.verbose).toHaveBeenCalledWith("Skipping database: tag appears to be a port number");
      expect(mockLogger.verbose).toHaveBeenCalledWith("Added database: pull_policy = ${DATABASE_PULL_POLICY-missing}");
    });

    it("should handle services with existing pull_policy that uses variables", async () => {
      const mockConfig = {
        version: "3.8",
        services: {
          web: {
            image: "nginx:1.21",
            pull_policy: "${PULL_POLICY}",
          },
        },
      };

      mockReadFileSync.mockReturnValue("mock file content");
      mockParse.mockReturnValue(mockConfig);
      mockStringify.mockReturnValue("modified content");

      const result = await modifyDockerCompose("/test/docker-compose.yml", mockLogger);

      expect(result.success).toBe(true);
      expect(result.modifiedServices).toEqual(["web"]);
      expect(mockLogger.verbose).toHaveBeenCalledWith("Skipping web: pull_policy already uses variables");
    });

    it("should handle service names with hyphens", async () => {
      const mockConfig = {
        version: "3.8",
        services: {
          "web-frontend": {
            image: "nginx:1.21",
          },
          "api-backend": {
            image: "node:16-alpine",
          },
        },
      };

      // The config object is modified in place, so we check the final state
      const expectedImage1 = "nginx:${WEB_FRONTEND_TAG_VER-1.21}";
      const expectedImage2 = "node:${API_BACKEND_TAG_VER-16-alpine}";
      const expectedPullPolicy1 = "${WEB_FRONTEND_PULL_POLICY-missing}";
      const expectedPullPolicy2 = "${API_BACKEND_PULL_POLICY-missing}";

      mockReadFileSync.mockReturnValue("mock file content");
      mockParse.mockReturnValue(mockConfig);
      mockStringify.mockReturnValue("modified content");

      const result = await modifyDockerCompose("/test/docker-compose.yml", mockLogger);

      expect(result.success).toBe(true);
      expect(result.modifiedServices).toEqual(["web-frontend", "api-backend"]);
      // Verify the config was modified correctly
      expect(mockConfig.services["web-frontend"].image).toBe(expectedImage1);
      expect((mockConfig.services["web-frontend"] as any).pull_policy).toBe(expectedPullPolicy1);
      expect(mockConfig.services["api-backend"].image).toBe(expectedImage2);
      expect((mockConfig.services["api-backend"] as any).pull_policy).toBe(expectedPullPolicy2);
      expect(mockStringify).toHaveBeenCalledWith(mockConfig, expect.any(Object));
    });

    it("should handle services with existing pull_policy (non-variable)", async () => {
      const mockConfig = {
        version: "3.8",
        services: {
          web: {
            image: "nginx:1.21",
            pull_policy: "always",
          },
        },
      };

      mockReadFileSync.mockReturnValue("mock file content");
      mockParse.mockReturnValue(mockConfig);
      mockStringify.mockReturnValue("modified content");

      const result = await modifyDockerCompose("/test/docker-compose.yml", mockLogger);

      expect(result.success).toBe(true);
      expect(result.modifiedServices).toEqual(["web"]);
      expect(mockLogger.verbose).toHaveBeenCalledWith("Modified web: pull_policy always → ${WEB_PULL_POLICY-missing}");
    });

    it("should return error when no services section exists", async () => {
      const mockConfig = {
        version: "3.8",
      };

      mockReadFileSync.mockReturnValue("mock file content");
      mockParse.mockReturnValue(mockConfig);

      const result = await modifyDockerCompose("/test/docker-compose.yml", mockLogger);

      expect(result.success).toBe(false);
      expect(result.errors).toEqual(["No services section found in docker-compose file"]);
      expect(result.modifiedServices).toEqual([]);
    });

    it("should handle file read errors", async () => {
      const error = new Error("File not found");
      mockReadFileSync.mockImplementation(() => {
        throw error;
      });

      const result = await modifyDockerCompose("/test/docker-compose.yml", mockLogger);

      expect(result.success).toBe(false);
      expect(result.errors).toEqual(["File not found"]);
      expect(result.modifiedServices).toEqual([]);
      expect(mockLogger.error).toHaveBeenCalledWith("Failed to modify docker-compose file: File not found");
    });

    it("should handle YAML parse errors", async () => {
      const error = new Error("Invalid YAML");
      mockReadFileSync.mockReturnValue("invalid yaml content");
      mockParse.mockImplementation(() => {
        throw error;
      });

      const result = await modifyDockerCompose("/test/docker-compose.yml", mockLogger);

      expect(result.success).toBe(false);
      expect(result.errors).toEqual(["Invalid YAML"]);
      expect(mockLogger.error).toHaveBeenCalledWith("Failed to modify docker-compose file: Invalid YAML");
    });

    it("should handle file write errors", async () => {
      const mockConfig = {
        version: "3.8",
        services: {
          web: {
            image: "nginx:1.21",
          },
        },
      };

      const writeError = new Error("Permission denied");
      mockReadFileSync.mockReturnValue("mock file content");
      mockParse.mockReturnValue(mockConfig);
      mockStringify.mockReturnValue("modified content");
      mockWriteFileSync.mockImplementation(() => {
        throw writeError;
      });

      const result = await modifyDockerCompose("/test/docker-compose.yml", mockLogger);

      expect(result.success).toBe(false);
      expect(result.errors).toEqual(["Permission denied"]);
      expect(mockLogger.error).toHaveBeenCalledWith("Failed to modify docker-compose file: Permission denied");
    });

    it("should handle non-Error exceptions", async () => {
      mockReadFileSync.mockImplementation(() => {
        throw "String error";
      });

      const result = await modifyDockerCompose("/test/docker-compose.yml", mockLogger);

      expect(result.success).toBe(false);
      expect(result.errors).toEqual(["String error"]);
      expect(mockLogger.error).toHaveBeenCalledWith("Failed to modify docker-compose file: String error");
    });
  });

  describe("integration scenarios", () => {
    it("should handle complex docker-compose file with mixed scenarios", async () => {
      const mockConfig = {
        version: "3.8",
        services: {
          web: {
            image: "nginx:1.21",
            ports: ["80:80"],
          },
          "api-service": {
            image: "node:${NODE_VERSION}",
            environment: ["NODE_ENV=production"],
          },
          database: {
            image: "postgres:5432",
            volumes: ["db-data:/var/lib/postgresql/data"],
          },
          redis: {
            image: "redis",
            ports: ["6379:6379"],
          },
          worker: {
            image: "myapp:v1.2.3",
            pull_policy: "always",
          },
        },
      };

      mockReadFileSync.mockReturnValue("mock file content");
      mockParse.mockReturnValue(mockConfig);
      mockStringify.mockReturnValue("modified content");

      const result = await modifyDockerCompose("/test/docker-compose.yml", mockLogger);

      expect(result.success).toBe(true);
      expect(result.modifiedServices).toEqual(["web", "api-service", "database", "redis", "worker"]);
      expect(result.errors).toEqual([]);

      // Verify specific modifications
      expect(mockConfig.services.web.image).toBe("nginx:${WEB_TAG_VER-1.21}");
      expect((mockConfig.services.web as any).pull_policy).toBe("${WEB_PULL_POLICY-missing}");
      expect(mockConfig.services.worker.image).toBe("myapp:${WORKER_TAG_VER-v1.2.3}");
      expect((mockConfig.services.worker as any).pull_policy).toBe("${WORKER_PULL_POLICY-missing}");

      // Verify skipped services
      expect(mockConfig.services["api-service"].image).toBe("node:${NODE_VERSION}");
      expect(mockConfig.services.database.image).toBe("postgres:5432");
      expect(mockConfig.services.redis.image).toBe("redis");
    });

    it("should preserve all other service properties", async () => {
      const mockConfig = {
        version: "3.8",
        services: {
          web: {
            image: "nginx:1.21",
            ports: ["80:80"],
            environment: ["ENV=prod"],
            volumes: ["./config:/etc/nginx"],
            depends_on: ["database"],
            networks: ["frontend"],
            restart: "unless-stopped",
            labels: ["traefik.enable=true"],
          },
        },
      };

      mockReadFileSync.mockReturnValue("mock file content");
      mockParse.mockReturnValue(mockConfig);
      mockStringify.mockReturnValue("modified content");

      const result = await modifyDockerCompose("/test/docker-compose.yml", mockLogger);

      expect(result.success).toBe(true);
      expect(result.modifiedServices).toEqual(["web"]);

      // Verify image and pull_policy were modified
      expect(mockConfig.services.web.image).toBe("nginx:${WEB_TAG_VER-1.21}");
      expect((mockConfig.services.web as any).pull_policy).toBe("${WEB_PULL_POLICY-missing}");

      // Verify all other properties are preserved
      expect(mockConfig.services.web.ports).toEqual(["80:80"]);
      expect(mockConfig.services.web.environment).toEqual(["ENV=prod"]);
      expect(mockConfig.services.web.volumes).toEqual(["./config:/etc/nginx"]);
      expect(mockConfig.services.web.depends_on).toEqual(["database"]);
      expect(mockConfig.services.web.networks).toEqual(["frontend"]);
      expect(mockConfig.services.web.restart).toBe("unless-stopped");
      expect(mockConfig.services.web.labels).toEqual(["traefik.enable=true"]);
    });
  });
});
