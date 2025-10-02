/**
 * Tests for timestamp formatting utilities
 */

import { describe, expect, it } from "vitest";
import {
  formatTimestamp,
  getCurrentTimestamp,
  getPeriodGranularity,
  isValidPeriodConfig,
  type PeriodConfig,
} from "./timestamp-formatter.js";

describe("timestamp-formatter", () => {
  // Fixed test date: 2024-09-12 13:45:30 UTC
  const testDate = new Date("2024-09-12T13:45:30.000Z");

  describe("formatTimestamp", () => {
    describe("string period formats", () => {
      it("should format hourly period correctly", () => {
        const result = formatTimestamp(testDate, "hourly");
        expect(result).toBe("20240912_13");
      });

      it("should format weekly period correctly", () => {
        const result = formatTimestamp(testDate, "weekly");
        expect(result).toBe("20240912");
      });

      it("should format monthly period correctly", () => {
        const result = formatTimestamp(testDate, "monthly");
        expect(result).toBe("202409");
      });

      it("should format yearly period correctly", () => {
        const result = formatTimestamp(testDate, "yearly");
        expect(result).toBe("2024");
      });

      it("should throw error for unknown string period", () => {
        expect(() => formatTimestamp(testDate, "invalid" as any)).toThrow("Unknown string period format: invalid");
      });
    });

    describe("object period formats", () => {
      it("should format seconds period correctly", () => {
        const result = formatTimestamp(testDate, {
          unit: "seconds",
          number: 1,
        });
        expect(result).toBe("20240912_134530");
      });

      it("should format minutes period correctly", () => {
        const result = formatTimestamp(testDate, {
          unit: "minutes",
          number: 1,
        });
        expect(result).toBe("20240912_1345");
      });

      it("should format hours period correctly", () => {
        const result = formatTimestamp(testDate, { unit: "hours", number: 1 });
        expect(result).toBe("20240912_13");
      });

      it("should format days period correctly", () => {
        const result = formatTimestamp(testDate, { unit: "days", number: 1 });
        expect(result).toBe("20240912");
      });

      it("should format weeks period correctly", () => {
        const result = formatTimestamp(testDate, { unit: "weeks", number: 1 });
        expect(result).toBe("20240912");
      });

      it("should format months period correctly", () => {
        const result = formatTimestamp(testDate, { unit: "months", number: 1 });
        expect(result).toBe("202409");
      });

      it("should format none period correctly", () => {
        const result = formatTimestamp(testDate, { unit: "none" });
        expect(result).toBe("");
      });

      it("should throw error for unknown object period unit", () => {
        expect(() => formatTimestamp(testDate, { unit: "invalid" as any, number: 1 })).toThrow(
          "Unknown object period unit: invalid",
        );
      });
    });

    describe("default behavior", () => {
      it("should format full timestamp when no period specified", () => {
        const result = formatTimestamp(testDate);
        expect(result).toBe("20240912_134530");
      });

      it("should format full timestamp when period is undefined", () => {
        const result = formatTimestamp(testDate, undefined);
        expect(result).toBe("20240912_134530");
      });
    });

    describe("edge cases", () => {
      it("should handle single-digit dates correctly", () => {
        const singleDigitDate = new Date("2024-01-05T08:05:03.000Z");
        const result = formatTimestamp(singleDigitDate);
        expect(result).toBe("20240105_080503");
      });

      it("should handle end of year correctly", () => {
        const endOfYear = new Date("2024-12-31T23:59:59.000Z");
        const result = formatTimestamp(endOfYear, "monthly");
        expect(result).toBe("202412");
      });

      it("should handle leap year correctly", () => {
        const leapDay = new Date("2024-02-29T12:00:00.000Z");
        const result = formatTimestamp(leapDay, "yearly");
        expect(result).toBe("2024");
      });
    });
  });

  describe("getCurrentTimestamp", () => {
    it("should return a valid timestamp string", () => {
      const result = getCurrentTimestamp();
      // Should match YYYYMMDD_HHMMSS format
      expect(result).toMatch(/^\d{8}_\d{6}$/);
    });

    it("should apply period formatting", () => {
      const result = getCurrentTimestamp("monthly");
      // Should match YYYYMM format (year and month only)
      expect(result).toMatch(/^\d{6}$/);
    });

    it("should handle object period", () => {
      const result = getCurrentTimestamp({ unit: "hours", number: 1 });
      // Should match YYYYMMDD_HH format (down to hours)
      expect(result).toMatch(/^\d{8}_\d{2}$/);
    });
  });

  describe("isValidPeriodConfig", () => {
    describe("valid configurations", () => {
      it("should validate string periods", () => {
        expect(isValidPeriodConfig("hourly")).toBe(true);
        expect(isValidPeriodConfig("weekly")).toBe(true);
        expect(isValidPeriodConfig("monthly")).toBe(true);
        expect(isValidPeriodConfig("yearly")).toBe(true);
      });

      it("should validate object periods with units", () => {
        expect(isValidPeriodConfig({ unit: "seconds", number: 1 })).toBe(true);
        expect(isValidPeriodConfig({ unit: "minutes", number: 5 })).toBe(true);
        expect(isValidPeriodConfig({ unit: "hours", number: 2 })).toBe(true);
        expect(isValidPeriodConfig({ unit: "days", number: 1 })).toBe(true);
        expect(isValidPeriodConfig({ unit: "weeks", number: 1 })).toBe(true);
        expect(isValidPeriodConfig({ unit: "months", number: 1 })).toBe(true);
      });

      it("should validate none unit", () => {
        expect(isValidPeriodConfig({ unit: "none" })).toBe(true);
      });

      it("should validate undefined", () => {
        expect(isValidPeriodConfig(undefined)).toBe(true);
      });

      it("should validate object periods without number", () => {
        expect(isValidPeriodConfig({ unit: "hours" })).toBe(true);
      });
    });

    describe("invalid configurations", () => {
      it("should reject invalid string periods", () => {
        expect(isValidPeriodConfig("invalid")).toBe(false);
        expect(isValidPeriodConfig("daily")).toBe(false);
      });

      it("should reject invalid object units", () => {
        expect(isValidPeriodConfig({ unit: "invalid", number: 1 })).toBe(false);
        expect(isValidPeriodConfig({ unit: "yearly", number: 1 })).toBe(false);
      });

      it("should reject invalid types", () => {
        expect(isValidPeriodConfig(123)).toBe(false);
        expect(isValidPeriodConfig(null)).toBe(false);
        expect(isValidPeriodConfig([])).toBe(false);
        expect(isValidPeriodConfig({})).toBe(false);
      });

      it("should reject objects with invalid number types", () => {
        expect(isValidPeriodConfig({ unit: "hours", number: "invalid" })).toBe(false);
      });
    });
  });

  describe("getPeriodGranularity", () => {
    it("should return correct granularity for string periods", () => {
      expect(getPeriodGranularity("yearly")).toBe(1);
      expect(getPeriodGranularity("monthly")).toBe(2);
      expect(getPeriodGranularity("weekly")).toBe(3);
      expect(getPeriodGranularity("hourly")).toBe(4);
    });

    it("should return correct granularity for object periods", () => {
      expect(getPeriodGranularity({ unit: "none" })).toBe(0);
      expect(getPeriodGranularity({ unit: "months", number: 1 })).toBe(2);
      expect(getPeriodGranularity({ unit: "weeks", number: 1 })).toBe(3);
      expect(getPeriodGranularity({ unit: "days", number: 1 })).toBe(3);
      expect(getPeriodGranularity({ unit: "hours", number: 1 })).toBe(4);
      expect(getPeriodGranularity({ unit: "minutes", number: 1 })).toBe(5);
      expect(getPeriodGranularity({ unit: "seconds", number: 1 })).toBe(6);
    });

    it("should return default granularity for undefined", () => {
      expect(getPeriodGranularity()).toBe(6);
      expect(getPeriodGranularity(undefined)).toBe(6);
    });

    it("should handle invalid periods gracefully", () => {
      expect(getPeriodGranularity("invalid" as any)).toBe(6);
      expect(getPeriodGranularity({ unit: "invalid" } as any)).toBe(6);
    });

    it("should allow granularity comparison", () => {
      // More granular periods should have higher numbers
      expect(getPeriodGranularity("yearly")).toBeLessThan(getPeriodGranularity("monthly"));
      expect(getPeriodGranularity("monthly")).toBeLessThan(getPeriodGranularity("weekly"));
      expect(getPeriodGranularity("weekly")).toBeLessThan(getPeriodGranularity("hourly"));
      expect(getPeriodGranularity({ unit: "hours", number: 1 })).toBeLessThan(
        getPeriodGranularity({ unit: "minutes", number: 1 }),
      );
      expect(getPeriodGranularity({ unit: "minutes", number: 1 })).toBeLessThan(
        getPeriodGranularity({ unit: "seconds", number: 1 }),
      );
    });
  });

  describe("integration scenarios", () => {
    it("should handle real-world docker tag scenarios", () => {
      const buildTime = new Date("2024-09-12T13:45:30.000Z");

      // Hourly builds - changes every hour
      const hourlyTag = formatTimestamp(buildTime, "hourly");
      expect(hourlyTag).toBe("20240912_13");

      // Daily builds - changes every day
      const dailyTag = formatTimestamp(buildTime, { unit: "days", number: 1 });
      expect(dailyTag).toBe("20240912");

      // No cache - always rebuilds
      const alwaysTag = formatTimestamp(buildTime);
      expect(alwaysTag).toBe("20240912_134530");
    });

    it("should maintain consistent format across different dates", () => {
      const dates = [
        new Date("2024-01-01T00:00:00.000Z"),
        new Date("2024-06-15T12:30:45.000Z"),
        new Date("2024-12-31T23:59:59.000Z"),
      ];

      for (const date of dates) {
        const result = formatTimestamp(date, "monthly");
        expect(result).toMatch(/^\d{6}$/); // YYYYMM format
      }
    });

    it("should work with period validation in pipeline", () => {
      const periods: unknown[] = ["hourly", { unit: "days", number: 1 }, { unit: "none" }, "invalid", null];

      const validPeriods = periods.filter(isValidPeriodConfig);
      expect(validPeriods).toHaveLength(3);

      for (const period of validPeriods) {
        const timestamp = formatTimestamp(testDate, period as PeriodConfig);
        expect(typeof timestamp).toBe("string");
        // Note: "none" period returns empty string, which is valid
        expect(timestamp.length).toBeGreaterThanOrEqual(0);
      }
    });
  });
});
