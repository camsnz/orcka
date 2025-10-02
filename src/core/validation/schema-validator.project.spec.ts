import { describe, expect, it } from "vitest";
import { validateSchema } from "./schema-validator.js";
import { createConfig, createProject } from "./test-utils/schema-test-helpers.js";

describe("schema-validator", () => {
  describe("project validation", () => {
    it("accepts a minimal valid project", () => {
      const errors = validateSchema(createConfig());
      expect(errors).toEqual([]);
    });

    it("requires project.name", () => {
      const config = createConfig({
        project: createProject({ name: undefined as unknown as string }),
      });

      const errors = validateSchema(config);

      expect(errors).toContainEqual({
        type: "schema",
        message: "project.name is required",
      });
    });

    it("requires project.write", () => {
      const config = createConfig({
        project: createProject({ write: undefined as unknown as string }),
      });

      const errors = validateSchema(config);

      expect(errors).toContainEqual({
        type: "schema",
        message: "project.write is required",
      });
    });

    it("requires project.bake to be a non-empty array", () => {
      const config = createConfig({
        project: createProject({ bake: undefined as unknown as string[] }),
      });

      const errors = validateSchema(config);

      expect(errors).toContainEqual({
        type: "schema",
        message: "project.bake is required and must be a non-empty array",
      });
    });

    it("rejects empty bake array", () => {
      const config = createConfig({
        project: createProject({ bake: [] }),
      });

      const errors = validateSchema(config);

      expect(errors).toContainEqual({
        type: "schema",
        message: "project.bake is required and must be a non-empty array",
      });
    });

    it("rejects non-array bake values", () => {
      const config = createConfig({
        project: createProject({
          bake: "docker-bake.hcl" as unknown as string[],
        }),
      });

      const errors = validateSchema(config);

      expect(errors).toContainEqual({
        type: "schema",
        message: "project.bake is required and must be a non-empty array",
      });
    });
  });

  describe("graceful handling of optional sections", () => {
    it("handles configs without a project section", () => {
      const config = { targets: {} } as ReturnType<typeof createConfig>;
      const errors = validateSchema(config);
      expect(errors).toEqual([]);
    });

    it("handles configs without targets", () => {
      const config = createConfig({ targets: undefined });
      const errors = validateSchema(config);
      expect(errors).toEqual([]);
    });
  });
});
