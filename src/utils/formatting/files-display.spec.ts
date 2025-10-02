import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { collectCalculationFiles, displayFilesSection, type FilesSectionData } from "./files-display.js";

describe("files-display", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it("collectCalculationFiles returns structured data", () => {
    const result = collectCalculationFiles("docker-sha.yml", ["docker-bake.hcl"], ["compose.yml"]);

    expect(result).toEqual<FilesSectionData>({
      orcka: ["docker-sha.yml"],
      bake: ["docker-bake.hcl"],
      compose: ["compose.yml"],
    });
  });

  it("displays single entries inline", () => {
    displayFilesSection({
      orcka: ["docker-sha.yml"],
      bake: ["docker-bake.hcl"],
      compose: ["compose.yml"],
    });

    expect(logSpy).toHaveBeenNthCalledWith(1, "");
    expect(logSpy).toHaveBeenNthCalledWith(2, "✅ Reading files:");
    expect(logSpy).toHaveBeenNthCalledWith(3, "  • orcka: docker-sha.yml");
    expect(logSpy).toHaveBeenNthCalledWith(4, "  • bake: docker-bake.hcl");
    expect(logSpy).toHaveBeenNthCalledWith(5, "  • compose: compose.yml");
  });

  it("displays multiple entries as bullet lists", () => {
    displayFilesSection({
      orcka: ["a.yaml", "b.yaml"],
      bake: ["bake-a.hcl", "bake-b.hcl"],
      compose: ["compose-a.yml", "compose-b.yml"],
    });

    expect(logSpy).toHaveBeenNthCalledWith(1, "");
    expect(logSpy).toHaveBeenNthCalledWith(2, "✅ Reading files:");
    expect(logSpy).toHaveBeenNthCalledWith(3, "  • orcka:");
    expect(logSpy).toHaveBeenNthCalledWith(4, "    - a.yaml");
    expect(logSpy).toHaveBeenNthCalledWith(5, "    - b.yaml");
    expect(logSpy).toHaveBeenNthCalledWith(6, "  • bake:");
    expect(logSpy).toHaveBeenNthCalledWith(7, "    - bake-a.hcl");
    expect(logSpy).toHaveBeenNthCalledWith(8, "    - bake-b.hcl");
    expect(logSpy).toHaveBeenNthCalledWith(9, "  • compose:");
    expect(logSpy).toHaveBeenNthCalledWith(10, "    - compose-a.yml");
    expect(logSpy).toHaveBeenNthCalledWith(11, "    - compose-b.yml");
  });

  it("omits categories with no files", () => {
    displayFilesSection({
      orcka: [],
      bake: [],
      compose: [],
    });

    expect(logSpy).toHaveBeenCalledTimes(2);
    expect(logSpy).toHaveBeenNthCalledWith(1, "");
    expect(logSpy).toHaveBeenNthCalledWith(2, "✅ Reading files:");
  });

  it("marks missing files", () => {
    displayFilesSection(
      {
        orcka: ["docker-sha.yml"],
        bake: ["missing.hcl"],
        compose: [],
      },
      {
        emoji: "🔴",
        missingEntries: { bake: new Set(["missing.hcl"]) },
      },
    );

    expect(logSpy).toHaveBeenNthCalledWith(2, "🔴 Reading files:");
    expect(logSpy).toHaveBeenNthCalledWith(4, "  • bake: missing.hcl ❌");
  });
});
