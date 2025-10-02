import { describe, expect, it } from "vitest";
import type { ValidationError } from "../../types.js";
import { validateRequiredTopLevelFields } from "./schema-validator.js";

describe("schema-validator", () => {
  describe("validateRequiredTopLevelFields", () => {
    it("does nothing for valid config", () => {
      const config = { project: { name: "test" }, targets: { web: {} } };
      const errors: ValidationError[] = [];

      validateRequiredTopLevelFields(config, errors, "/test/docker-sha.yml");

      expect(errors).toEqual([]);
    });

    it("adds error for missing project section", () => {
      const config = { targets: { web: {} } };
      const errors: ValidationError[] = [];

      validateRequiredTopLevelFields(config, errors, "/test/docker-sha.yml");

      expect(errors).toContainEqual({
        type: "schema",
        message: "Missing required 'project' section in docker-sha.yml",
        path: "/test/docker-sha.yml",
      });
    });

    it("adds error for missing targets section", () => {
      const config = { project: { name: "test" } };
      const errors: ValidationError[] = [];

      validateRequiredTopLevelFields(config, errors, "/test/docker-sha.yml");

      expect(errors).toContainEqual({
        type: "schema",
        message: "Missing required 'targets' section in docker-sha.yml",
        path: "/test/docker-sha.yml",
      });
    });

    it("adds both errors when both sections are missing", () => {
      const config = {};
      const errors: ValidationError[] = [];

      validateRequiredTopLevelFields(config, errors, "/app/docker-sha.yml");

      expect(errors).toHaveLength(2);
      expect(errors).toContainEqual({
        type: "schema",
        message: "Missing required 'project' section in docker-sha.yml",
        path: "/app/docker-sha.yml",
      });
      expect(errors).toContainEqual({
        type: "schema",
        message: "Missing required 'targets' section in docker-sha.yml",
        path: "/app/docker-sha.yml",
      });
    });

    it("throws when config is null", () => {
      const errors: ValidationError[] = [];

      expect(() => {
        validateRequiredTopLevelFields(null as unknown as object, errors, "/test/docker-sha.yml");
      }).toThrow();
    });
  });
});
