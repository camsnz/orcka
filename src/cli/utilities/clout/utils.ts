/**
 * Utility functions for text formatting
 */

import type { Alignment, PaddingOptions } from "./types";

/**
 * Get the effective terminal width
 */
export function getTerminalWidth(): number {
  return process.stdout.columns || 80;
}

/**
 * Apply padding to all sides
 */
export function applyPadding(padding: PaddingOptions | undefined, defaultValue: number = 0): Required<PaddingOptions> {
  return {
    top: padding?.top ?? defaultValue,
    bottom: padding?.bottom ?? defaultValue,
    left: padding?.left ?? defaultValue,
    right: padding?.right ?? defaultValue,
  };
}

/**
 * Pad text to a specific width with alignment
 */
export function padText(text: string, width: number, align: Alignment = "left"): string {
  if (text.length >= width) {
    return text;
  }

  const padding = width - text.length;

  switch (align) {
    case "left":
      return text + " ".repeat(padding);
    case "right":
      return " ".repeat(padding) + text;
    case "center": {
      const leftPad = Math.floor(padding / 2);
      const rightPad = padding - leftPad;
      return " ".repeat(leftPad) + text + " ".repeat(rightPad);
    }
  }
}

/**
 * Wrap text to a specific width
 */
export function wrapText(text: string, width: number): string[] {
  if (width <= 0) return [text];
  if (text.length === 0) return [""];

  const lines: string[] = [];
  const words = text.split(/\s+/);
  let currentLine = "";

  for (const word of words) {
    // If word itself is longer than width, split it
    if (word.length > width) {
      if (currentLine) {
        lines.push(currentLine.trim());
        currentLine = "";
      }
      // Split long word
      for (let i = 0; i < word.length; i += width) {
        lines.push(word.slice(i, i + width));
      }
      continue;
    }

    // Try adding word to current line
    const testLine = currentLine ? `${currentLine} ${word}` : word;

    if (testLine.length <= width) {
      currentLine = testLine;
    } else {
      if (currentLine) {
        lines.push(currentLine);
      }
      currentLine = word;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.length > 0 ? lines : [""];
}

/**
 * Apply indentation to text lines
 */
export function applyIndent(lines: string[], indent: number = 0, hangingIndent: number = 0): string[] {
  if (indent === 0 && hangingIndent === 0) {
    return lines;
  }

  return lines.map((line, index) => {
    const indentSize = index === 0 ? indent : indent + hangingIndent;
    return " ".repeat(indentSize) + line;
  });
}

/**
 * Apply margin to lines
 */
export function applyMargin(lines: string[], margin: Required<PaddingOptions>): string[] {
  const result: string[] = [];

  // Top margin
  for (let i = 0; i < margin.top; i++) {
    result.push("");
  }

  // Left and right margin
  const leftMargin = " ".repeat(margin.left);
  const processedLines = lines.map((line) => leftMargin + line);
  result.push(...processedLines);

  // Bottom margin
  for (let i = 0; i < margin.bottom; i++) {
    result.push("");
  }

  return result;
}

/**
 * Truncate text with ellipsis if it exceeds max length
 */
export function truncateWithEllipsis(text: string, maxLength: number, ellipsis: string = "..."): string {
  if (text.length <= maxLength) return text;
  if (maxLength <= ellipsis.length) return ellipsis.substring(0, maxLength);
  return text.substring(0, maxLength - ellipsis.length) + ellipsis;
}

/**
 * Create a horizontal line/divider
 */
export function line(char: string = "-", width: number = getTerminalWidth()): string {
  return char.repeat(Math.max(0, width));
}
