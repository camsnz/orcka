import { describe, expect, it } from "vitest";
import type { DockerShaConfig } from "../../types.js";
import { validateSchema } from "./schema-validator.js";

describe("schema-validator", () => {
  describe("integration scenarios", () => {
    it("validates a complex real-world configuration", () => {
      const config: DockerShaConfig = {
        project: {
          name: "multi-service-app",
          context: ".",
          write: "generated/docker-tags.hcl",
          bake: ["docker-bake.hcl", "docker-bake.override.hcl"],
        },
        targets: {
          frontend: {
            dockerfile: "frontend/Dockerfile",
            context_of: "dockerfile",
            calculate_on: {
              files: ["frontend/package.json", "frontend/yarn.lock"],
              jq: ".dependencies",
            },
          },
          backend: {
            dockerfile: "backend/Dockerfile",
            context_of: "orcka",
            calculate_on: {
              period: { unit: "days", number: 1 },
              files: ["backend/requirements.txt"],
            },
          },
          worker: {
            dockerfile: "worker/Dockerfile",
            calculate_on: { always: true },
          },
          nginx: {
            dockerfile: "nginx/Dockerfile",
            calculate_on: { period: "weekly" },
          },
        },
      };

      const errors = validateSchema(config);
      expect(errors).toEqual([]);
    });

    it("accumulates multiple validation errors", () => {
      const config: DockerShaConfig = {
        project: {
          bake: [],
        } as unknown as DockerShaConfig["project"],
        targets: {
          invalid1: {
            dockerfile: "Dockerfile",
            context_of: "invalid" as unknown as string,
            calculate_on: {},
          },
          invalid2: {
            dockerfile: "Dockerfile",
            calculate_on: {
              period: { unit: "invalid", number: -1 } as unknown as {
                unit: string;
              },
            },
          },
        },
      };

      const errors = validateSchema(config);

      expect(errors.length).toBeGreaterThan(5);
      expect(errors.some((error) => error.message.includes("project.name is required"))).toBe(true);
      expect(errors.some((error) => error.message.includes("project.write is required"))).toBe(true);
      expect(errors.some((error) => error.message.includes("non-empty array"))).toBe(true);
      expect(errors.some((error) => error.message.includes("invalid context_of"))).toBe(true);
      expect(errors.some((error) => error.message.includes("at least one valid calculate_on"))).toBe(true);
    });
  });
});
