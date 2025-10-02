import { afterEach, describe, expect, it, vi } from "vitest";
import { displayTargetsSection, formatCalculationCriteria } from "./targets-display.js";

describe("formatCalculationCriteria", () => {
  it("returns A when no criteria are provided", () => {
    expect(formatCalculationCriteria(undefined)).toBe("A");
    expect(formatCalculationCriteria({})).toBe("A");
  });

  it("returns F when files criteria is present", () => {
    expect(formatCalculationCriteria({ files: ["Dockerfile"] })).toBe("F");
  });

  it("combines flags in stable order", () => {
    expect(
      formatCalculationCriteria({
        files: ["a"],
        jq: { filename: "b", selector: "." },
        always: true,
      }),
    ).toBe("FJA");
  });

  it("uses period initial for simple period strings", () => {
    expect(formatCalculationCriteria({ period: "weekly" })).toBe("W");
  });

  it("maps complex period units to their initial", () => {
    expect(formatCalculationCriteria({ period: { unit: "days", number: 7 } })).toBe("D");
  });

  it("uses N when period unit is none", () => {
    expect(formatCalculationCriteria({ period: { unit: "none" } })).toBe("N");
  });

  it("defaults to P when period unit is missing", () => {
    expect(
      formatCalculationCriteria({
        period: { number: 3 } as unknown as { unit: string },
      }),
    ).toBe("P");
  });

  it("includes D flag when date criteria present", () => {
    expect(formatCalculationCriteria({ date: "2024-01-01" })).toBe("D");
  });
});

describe("displayTargetsSection", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders statuses and truncates content", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    displayTargetsSection([
      {
        name: "super-long-target-name",
        calculationCriteria: "ABCDEFG",
        tagVer: "x".repeat(60),
        status: "not_found",
      },
      {
        name: "worker",
        calculationCriteria: "F",
        tagVer: "value",
        status: "requires_dependency",
        requiredTarget: "db",
      },
    ]);

    // Clout.table outputs a single multi-line string
    expect(logSpy).toHaveBeenCalledTimes(1);
    const output = logSpy.mock.calls[0][0] as string;
    expect(output).toContain("❌ not found");
    expect(output).toContain("...");
    expect(output).toContain("requires db");
    expect(output).toContain("worker");
  });

  it("skips logging when no targets", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    displayTargetsSection([]);
    expect(logSpy).not.toHaveBeenCalled();
  });
});
