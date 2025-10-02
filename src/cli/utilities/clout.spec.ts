import { beforeEach, describe, expect, it } from "vitest";
import { banner, box, Clout, formatText, heading, line, list, paragraph } from "./clout";

describe("Clout - Command Line OUT", () => {
  let originalColumns: number;

  beforeEach(() => {
    originalColumns = process.stdout.columns;
    process.stdout.columns = 80;
  });

  afterEach(() => {
    process.stdout.columns = originalColumns;
  });

  describe("line", () => {
    it("creates a horizontal line with default character", () => {
      const result = line();
      expect(result).toBe("-".repeat(80));
    });

    it("creates a line with custom character", () => {
      const result = line("=");
      expect(result).toBe("=".repeat(80));
    });

    it("creates a line with custom width", () => {
      const result = line("-", 40);
      expect(result).toBe("-".repeat(40));
    });

    it("handles zero width", () => {
      const result = line("-", 0);
      expect(result).toBe("");
    });
  });

  describe("formatText", () => {
    it("wraps text to specified width", () => {
      const text = "This is a long line that should wrap";
      const lines = formatText(text, { width: 20 });

      expect(lines.length).toBeGreaterThan(1);
      for (const line of lines) {
        expect(line.length).toBeLessThanOrEqual(20);
      }
    });

    it("aligns text left", () => {
      const lines = formatText("Hello", { width: 20, align: "left" });
      expect(lines[0]).toMatch(/^Hello\s+$/);
    });

    it("aligns text center", () => {
      const lines = formatText("Hello", { width: 20, align: "center" });
      expect(lines[0].trim()).toBe("Hello");
      expect(lines[0]).toMatch(/^\s+Hello\s+$/);
    });

    it("aligns text right", () => {
      const lines = formatText("Hello", { width: 20, align: "right" });
      expect(lines[0]).toMatch(/^\s+Hello$/);
    });

    it("applies indent to all lines", () => {
      const lines = formatText("Line 1 Line 2 Line 3", { width: 10, indent: 2 });
      for (const line of lines) {
        expect(line).toMatch(/^ {2}/);
      }
    });

    it("applies hanging indent after first line", () => {
      const text = "First line should have less indent than subsequent lines";
      const lines = formatText(text, { width: 20, indent: 2, hangingIndent: 2 });

      expect(lines[0]).toMatch(/^ {2}/); // 2 spaces
      if (lines.length > 1) {
        expect(lines[1]).toMatch(/^ {4}/); // 4 spaces
      }
    });

    it("applies margin", () => {
      const lines = formatText("Test", {
        margin: { top: 1, bottom: 1, left: 2, right: 0 },
      });

      expect(lines[0]).toBe(""); // Top margin
      expect(lines[1]).toMatch(/^ {2}/); // Left margin
      expect(lines[lines.length - 1]).toBe(""); // Bottom margin
    });

    it("handles empty text", () => {
      const lines = formatText("", { width: 20 });
      expect(lines).toEqual([""]);
    });

    it("splits very long words", () => {
      const longWord = "a".repeat(50);
      const lines = formatText(longWord, { width: 20 });

      expect(lines.length).toBeGreaterThan(1);
    });
  });

  describe("banner", () => {
    it("creates a basic banner with default settings", () => {
      const result = banner("Hello World");

      expect(result).toContain("Hello World");
      expect(result.split("\n").length).toBeGreaterThan(2);
    });

    it("creates banner with custom divider character", () => {
      const result = banner("Test", { dividerChar: "=" });

      expect(result).toContain("=".repeat(80));
    });

    it("centers text by default", () => {
      const result = banner("Centered");
      const lines = result.split("\n");

      // Find content line (not divider)
      const contentLine = lines.find((line) => line.includes("Centered") && !line.startsWith("-"));
      expect(contentLine).toBeDefined();
    });

    it("aligns text left", () => {
      const result = banner("Left", { align: "left" });
      expect(result).toContain("Left");
    });

    it("aligns text right", () => {
      const result = banner("Right", { align: "right" });
      expect(result).toContain("Right");
    });

    it("applies padding", () => {
      const result = banner("Test", { padding: { top: 2, bottom: 2, left: 3, right: 3 } });
      const lines = result.split("\n");

      // Should have extra blank lines for padding
      expect(lines.length).toBeGreaterThan(3);
    });

    it("supports custom width", () => {
      const result = banner("Test", { width: 40 });
      const lines = result.split("\n");

      // Divider lines should match custom width
      expect(lines[0].length).toBe(40);
    });

    it("can disable top border", () => {
      const result = banner("Test", { borderTop: false });
      const lines = result.split("\n");

      expect(lines[0]).not.toMatch(/^-+$/);
    });

    it("can disable bottom border", () => {
      const result = banner("Test", { borderBottom: false });
      const lines = result.split("\n");

      expect(lines[lines.length - 1]).not.toMatch(/^-+$/);
    });

    it("wraps long text", () => {
      const longText = "This is a very long text that should wrap to multiple lines";
      const result = banner(longText, { width: 30 });

      expect(result.split("\n").length).toBeGreaterThan(3);
    });

    it("applies margin", () => {
      const result = banner("Test", { margin: { top: 1, bottom: 1 } });
      const lines = result.split("\n");

      expect(lines[0]).toBe("");
      expect(lines[lines.length - 1]).toBe("");
    });

    it("supports indent and hanging indent", () => {
      const result = banner("First line and more text", {
        width: 30,
        indent: 2,
        hangingIndent: 2,
      });

      expect(result).toContain("  First"); // Indented
    });
  });

  describe("box", () => {
    it("creates a box around text", () => {
      const result = box("Content");
      const lines = result.split("\n");

      expect(lines[0]).toContain("+"); // Top border with corners
      expect(lines[lines.length - 1]).toContain("+"); // Bottom border with corners
      expect(result).toContain("Content");
    });

    it("uses custom character", () => {
      const result = box("Test", { char: "=" });

      expect(result).toContain("="); // Custom char for horizontal lines
      expect(result).toContain("Test");
    });

    it("preserves multi-line content", () => {
      const result = box("Line 1\nLine 2");
      const lines = result.split("\n");

      expect(lines.some((l) => l.includes("Line 1"))).toBe(true);
      expect(lines.some((l) => l.includes("Line 2"))).toBe(true);
    });

    it("applies padding", () => {
      const result = box("Test", { padding: { top: 1, bottom: 1, left: 2, right: 2 } });
      const lines = result.split("\n");

      expect(lines.length).toBeGreaterThan(3);
    });

    it("aligns content", () => {
      const result = box("Center", { align: "center", width: 40 });

      expect(result).toContain("Center");
    });

    it("supports custom width", () => {
      const result = box("Test", { width: 40 });
      const lines = result.split("\n");

      expect(lines[0].length).toBe(40);
    });
  });

  describe("paragraph", () => {
    it("formats text as a paragraph", () => {
      const text = "This is a paragraph with multiple words that should wrap";
      const result = paragraph(text, { width: 20 });

      expect(result.split("\n").length).toBeGreaterThan(1);
    });

    it("applies formatting options", () => {
      const result = paragraph("Test paragraph", { indent: 4, align: "center" });

      expect(result).toMatch(/^\s{4}/); // Should have indent
    });
  });

  describe("heading", () => {
    it("creates a level 1 heading", () => {
      const result = heading("Title", { level: 1 });

      expect(result).toContain("Title");
      expect(result).toContain("="); // Underline
    });

    it("creates a level 2 heading", () => {
      const result = heading("Subtitle", { level: 2, underlineChar: "-" });

      expect(result).toContain("## Subtitle");
      expect(result).toContain("-"); // Underline
    });

    it("creates a level 3 heading", () => {
      const result = heading("Section", { level: 3 });

      expect(result).toContain("### Section");
    });

    it("can disable underline", () => {
      const result = heading("No Underline", { underline: false });

      expect(result).toBe("No Underline");
    });

    it("supports custom underline character", () => {
      const result = heading("Custom", { underlineChar: "*" });

      expect(result).toContain("*");
    });

    it("centers heading", () => {
      const result = heading("Centered", { align: "center" });

      expect(result.split("\n")[0]).toMatch(/^\s+Centered\s+$/);
    });
  });

  describe("list", () => {
    it("creates a bulleted list", () => {
      const result = list(["Item 1", "Item 2", "Item 3"]);

      expect(result).toContain("• Item 1");
      expect(result).toContain("• Item 2");
      expect(result).toContain("• Item 3");
    });

    it("creates a numbered list", () => {
      const result = list(["First", "Second", "Third"], { numbered: true });

      expect(result).toContain("1. First");
      expect(result).toContain("2. Second");
      expect(result).toContain("3. Third");
    });

    it("supports custom bullet", () => {
      const result = list(["Item"], { bullet: "→" });

      expect(result).toContain("→ Item");
    });

    it("supports custom start number", () => {
      const result = list(["Item"], { numbered: true, startNumber: 5 });

      expect(result).toContain("5. Item");
    });

    it("applies indentation", () => {
      const result = list(["Item"], { indent: 4 });

      expect(result).toMatch(/^\s{4}/);
    });
  });

  describe("table", () => {
    it("creates a basic table", () => {
      const result = Clout.table(
        ["Name", "Age"],
        [
          ["Alice", "30"],
          ["Bob", "25"],
        ],
      );

      expect(result).toContain("Name");
      expect(result).toContain("Alice");
      expect(result).toContain("Bob");
    });

    it("adds borders", () => {
      const result = Clout.table(["Col1"], [["Data"]], { border: true });

      expect(result).toContain("|");
      expect(result).toContain("-");
    });

    it("creates borderless table", () => {
      const result = Clout.table(["Col1"], [["Data"]], { border: false });

      expect(result).not.toContain("|");
    });

    it("supports custom column widths", () => {
      const result = Clout.table(["A", "B"], [["1", "2"]], {
        columnWidths: [10, 20],
      });

      expect(result).toBeDefined();
    });

    it("aligns columns", () => {
      const result = Clout.table(["Left", "Center", "Right"], [["A", "B", "C"]], {
        align: ["left", "center", "right"],
      });

      expect(result).toContain("Left");
      expect(result).toContain("Center");
    });
  });

  describe("indent helper", () => {
    it("indents single line", () => {
      const result = Clout.indent("Text", 4);

      expect(result).toBe("    Text");
    });

    it("indents multiple lines", () => {
      const result = Clout.indent("Line 1\nLine 2", 2);

      expect(result).toBe("  Line 1\n  Line 2");
    });

    it("uses custom character", () => {
      const result = Clout.indent("Text", 3, ">");

      expect(result).toBe(">>>Text");
    });
  });

  describe("getTerminalWidth", () => {
    it("returns terminal width", () => {
      const width = Clout.getTerminalWidth();

      expect(width).toBe(80);
    });

    it("handles undefined columns", () => {
      process.stdout.columns = undefined as number | undefined;
      const width = Clout.getTerminalWidth();

      expect(width).toBe(80); // Default fallback
    });
  });

  describe("Clout object structure", () => {
    it("exports all expected methods", () => {
      expect(Clout).toHaveProperty("line");
      expect(Clout).toHaveProperty("banner");
      expect(Clout).toHaveProperty("box");
      expect(Clout).toHaveProperty("paragraph");
      expect(Clout).toHaveProperty("heading");
      expect(Clout).toHaveProperty("indent");
      expect(Clout).toHaveProperty("list");
      expect(Clout).toHaveProperty("table");
      expect(Clout).toHaveProperty("formatText");
      expect(Clout).toHaveProperty("getTerminalWidth");
    });

    it("all methods are functions or symbols object", () => {
      Object.entries(Clout).forEach(([key, value]) => {
        if (key === "symbols") {
          expect(typeof value).toBe("object");
        } else {
          expect(typeof value).toBe("function");
        }
      });
    });
  });
});
