import { describe, expect, it } from "vitest";
import type { DockerShaTarget } from "../../types.js";
import { validateSchema } from "./schema-validator.js";
import { createConfig, createTarget } from "./test-utils/schema-test-helpers.js";

describe("schema-validator", () => {
  describe("target calculate_on validation", () => {
    it("skips targets without calculate_on", () => {
      const config = createConfig({
        targets: {
          web: {} as DockerShaTarget,
        },
      });

      const errors = validateSchema(config);
      expect(errors).toEqual([]);
    });

    it("requires at least one valid calculate_on criteria", () => {
      const config = createConfig({
        targets: {
          web: createTarget({ calculate_on: {} }),
        },
      });

      const errors = validateSchema(config);

      expect(errors).toContainEqual({
        type: "schema",
        target: "web",
        message: "Target 'web' must have at least one valid calculate_on criteria (always, period, files, or jq)",
      });
    });

    it("accepts always: true", () => {
      const config = createConfig({
        targets: {
          web: createTarget({ calculate_on: { always: true } }),
        },
      });

      const errors = validateSchema(config);
      expect(errors).toEqual([]);
    });

    it("accepts a files array", () => {
      const config = createConfig({
        targets: {
          web: createTarget({ calculate_on: { files: ["package.json"] } }),
        },
      });

      const errors = validateSchema(config);
      expect(errors).toEqual([]);
    });

    it("accepts jq selectors", () => {
      const config = createConfig({
        targets: {
          web: createTarget({ calculate_on: { jq: ".version" } }),
        },
      });

      const errors = validateSchema(config);
      expect(errors).toEqual([]);
    });
  });

  describe("period validation", () => {
    it("accepts valid string periods", () => {
      for (const period of ["hourly", "weekly", "monthly", "yearly"]) {
        const config = createConfig({
          targets: {
            web: createTarget({ calculate_on: { period } }),
          },
        });

        const errors = validateSchema(config);
        expect(errors).toEqual([]);
      }
    });

    it("rejects invalid string periods", () => {
      const config = createConfig({
        targets: {
          web: createTarget({
            calculate_on: { period: "invalid" as unknown as string },
          }),
        },
      });

      const errors = validateSchema(config);

      expect(errors).toContainEqual({
        type: "schema",
        target: "web",
        message: "Target 'web' has invalid period format. Valid string periods are: hourly, weekly, monthly, yearly",
      });
    });

    it("accepts valid object periods", () => {
      const validPeriods = [
        { unit: "days", number: 7 },
        { unit: "hours", number: 24 },
        { unit: "minutes", number: 30 },
        { unit: "weeks", number: 2 },
        { unit: "months", number: 1 },
      ];

      for (const period of validPeriods) {
        const config = createConfig({
          targets: {
            web: createTarget({ calculate_on: { period } }),
          },
        });

        const errors = validateSchema(config);
        expect(errors).toEqual([]);
      }
    });

    it("accepts unit 'none' without number", () => {
      const config = createConfig({
        targets: {
          web: createTarget({ calculate_on: { period: { unit: "none" } } }),
        },
      });

      const errors = validateSchema(config);
      expect(errors).toEqual([]);
    });

    it("requires a unit field", () => {
      const config = createConfig({
        targets: {
          web: createTarget({
            calculate_on: {
              period: { number: 7 } as unknown as { unit: string },
            },
          }),
        },
      });

      const errors = validateSchema(config);

      expect(errors).toContainEqual({
        type: "schema",
        target: "web",
        message: "Target 'web' period must have a unit field",
      });
    });

    it("rejects invalid period units", () => {
      const config = createConfig({
        targets: {
          web: createTarget({
            calculate_on: {
              period: { unit: "invalid", number: 1 } as unknown as {
                unit: string;
              },
            },
          }),
        },
      });

      const errors = validateSchema(config);

      expect(errors).toContainEqual({
        type: "schema",
        target: "web",
        message:
          "Target 'web' has invalid period unit 'invalid'. Valid units are: months, weeks, days, hours, minutes, none",
      });
    });

    it("requires a positive number for non-'none' units", () => {
      const config = createConfig({
        targets: {
          web: createTarget({
            calculate_on: { period: { unit: "days", number: 0 } },
          }),
        },
      });

      const errors = validateSchema(config);

      expect(errors).toContainEqual({
        type: "schema",
        target: "web",
        message: "Target 'web' period must have a positive number when unit is not 'none'",
      });
    });

    it("requires number to be numeric", () => {
      const config = createConfig({
        targets: {
          web: createTarget({
            calculate_on: {
              period: { unit: "days", number: "7" as unknown as number },
            },
          }),
        },
      });

      const errors = validateSchema(config);

      expect(errors).toContainEqual({
        type: "schema",
        target: "web",
        message: "Target 'web' period must have a positive number when unit is not 'none'",
      });
    });
  });

  describe("context_of validation", () => {
    it("accepts valid context_of values", () => {
      for (const context_of of ["dockerfile", "orcka", "target", "bake"]) {
        const config = createConfig({
          targets: {
            web: createTarget({
              context_of: context_of as string,
              calculate_on: { always: true },
            }),
          },
        });

        const errors = validateSchema(config);
        expect(errors).toEqual([]);
      }
    });

    it("rejects invalid context_of values", () => {
      const config = createConfig({
        targets: {
          web: createTarget({
            context_of: "invalid" as unknown as string,
            calculate_on: { always: true },
          }),
        },
      });

      const errors = validateSchema(config);

      expect(errors).toContainEqual({
        type: "schema",
        target: "web",
        message:
          "Target 'web' has invalid context_of value 'invalid'. Valid values are: dockerfile, orcka, target, bake",
      });
    });
  });
});
