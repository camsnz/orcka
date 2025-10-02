/**
 * Core text formatting functions
 */

import type { Alignment, BannerOptions, BoxOptions, TextOptions } from "./types";
import {
  applyIndent,
  applyMargin,
  applyPadding,
  getTerminalWidth,
  line,
  padText,
  truncateWithEllipsis,
  wrapText,
} from "./utils";

/**
 * Format text with comprehensive options
 */
export function formatText(text: string, options: TextOptions = {}): string[] {
  const { width = getTerminalWidth(), align = "left", indent = 0, hangingIndent = 0, margin } = options;

  // Calculate effective width (accounting for indent)
  const effectiveWidth = width - indent - hangingIndent;

  // Wrap text
  let lines = wrapText(text, effectiveWidth);

  // Apply alignment (skip padding for empty text)
  if (text.length > 0) {
    lines = lines.map((line) => padText(line, effectiveWidth, align));
  }

  // Apply indentation
  lines = applyIndent(lines, indent, hangingIndent);

  // Apply margin
  if (margin) {
    const paddingValues = applyPadding(margin);
    lines = applyMargin(lines, paddingValues);
  }

  return lines;
}

/**
 * Create a banner with text and dividers
 */
export function banner(text: string, options: BannerOptions = {}): string {
  const {
    width = getTerminalWidth(),
    divider,
    dividerChar = "-",
    align = "center",
    indent = 0,
    hangingIndent = 0,
    padding,
    borderTop = true,
    borderBottom = true,
    margin,
  } = options;

  const paddingValues = applyPadding(padding, 1);
  const result: string[] = [];

  // Top border
  if (borderTop) {
    result.push(divider || line(dividerChar, width));
  }

  // Top padding
  for (let i = 0; i < paddingValues.top; i++) {
    result.push("");
  }

  // Format and add text content
  const textLines = formatText(text, {
    width: width - paddingValues.left - paddingValues.right,
    align,
    indent,
    hangingIndent,
  });

  // Apply left/right padding to content
  const leftPad = " ".repeat(paddingValues.left);
  const contentLines = textLines.map((line) => leftPad + line);
  result.push(...contentLines);

  // Bottom padding
  for (let i = 0; i < paddingValues.bottom; i++) {
    result.push("");
  }

  // Bottom border
  if (borderBottom) {
    result.push(divider || line(dividerChar, width));
  }

  // Apply margin
  let finalLines = result;
  if (margin) {
    const marginValues = applyPadding(margin);
    finalLines = applyMargin(result, marginValues);
  }

  return finalLines.join("\n");
}

/**
 * Create a box around text with optional rounded corners and title
 */
export function box(
  text: string,
  options: BoxOptions & { rounded?: boolean; title?: string; emoji?: string } = {},
): string {
  const { char = "-", width = getTerminalWidth(), padding, align = "left", rounded = false, title, emoji } = options;

  const paddingValues = applyPadding(padding, 0);
  const result: string[] = [];

  // Choose border characters
  const horizontal = rounded ? "─" : char;
  const vertical = rounded ? "│" : "|";
  const topLeft = rounded ? "╭" : "+";
  const topRight = rounded ? "╮" : "+";
  const bottomLeft = rounded ? "╰" : "+";
  const bottomRight = rounded ? "╯" : "+";

  // Top border with optional title and emoji
  if (title || emoji) {
    const titleText = emoji ? `${emoji} ${title || ""}` : title || "";
    const padding = 1; // Space around title
    const titleSection = ` ${titleText} `;
    const remainingWidth = width - titleSection.length - 2; // -2 for corners

    result.push(
      `${topLeft}${horizontal.repeat(padding)}${titleText}${horizontal.repeat(Math.max(0, remainingWidth - padding + 2))}${topRight}`,
    );
  } else {
    result.push(`${topLeft}${horizontal.repeat(width - 2)}${topRight}`);
  }

  // Top padding
  for (let i = 0; i < paddingValues.top; i++) {
    result.push(`${vertical}${" ".repeat(width - 2)}${vertical}`);
  }

  // Content with left/right padding
  const contentWidth = width - paddingValues.left - paddingValues.right - 2; // -2 for vertical borders
  const lines = text.split("\n");

  for (const contentLine of lines) {
    const leftPad = " ".repeat(paddingValues.left);
    const paddedLine = padText(contentLine, contentWidth, align);
    const rightPad = " ".repeat(paddingValues.right);
    result.push(`${vertical}${leftPad}${paddedLine}${rightPad}${vertical}`);
  }

  // Bottom padding
  for (let i = 0; i < paddingValues.bottom; i++) {
    result.push(`${vertical}${" ".repeat(width - 2)}${vertical}`);
  }

  // Bottom border
  result.push(`${bottomLeft}${horizontal.repeat(width - 2)}${bottomRight}`);

  return result.join("\n");
}

/**
 * Create a paragraph with word wrapping and formatting
 */
export function paragraph(text: string, options: TextOptions = {}): string {
  return formatText(text, options).join("\n");
}

/**
 * Create a heading with optional underline
 */
export function heading(
  text: string,
  options: {
    level?: 1 | 2 | 3;
    underline?: boolean;
    underlineChar?: string;
    align?: Alignment;
  } = {},
): string {
  const { level = 1, underline = true, underlineChar = "=", align = "left" } = options;

  const result: string[] = [];
  const prefix = level === 1 ? "" : level === 2 ? "## " : "### ";
  const formattedText = prefix + text;

  result.push(align === "center" ? padText(formattedText, getTerminalWidth(), "center") : formattedText);

  if (underline) {
    const underlineLength = formattedText.length;
    result.push(line(underlineChar, underlineLength));
  }

  return result.join("\n");
}

/**
 * Create indented text (useful for lists, quotes, etc.)
 */
export function indent(text: string, spaces: number = 2, char: string = " "): string {
  const indentStr = char.repeat(spaces);
  return text
    .split("\n")
    .map((line) => indentStr + line)
    .join("\n");
}

/**
 * Create a list with bullets or numbers
 */
export function list(
  items: string[],
  options: {
    numbered?: boolean;
    bullet?: string;
    indent?: number;
    startNumber?: number;
  } = {},
): string {
  const { numbered = false, bullet = "•", indent: indentSize = 2, startNumber = 1 } = options;

  return items
    .map((item, index) => {
      const prefix = numbered ? `${startNumber + index}. ` : `${bullet} `;
      const indentStr = " ".repeat(indentSize);
      return indentStr + prefix + item;
    })
    .join("\n");
}

/**
 * Create a table (basic implementation or use console.table)
 */
export function table(
  headers: string[],
  rows: string[][],
  options: {
    columnWidths?: number[];
    align?: Alignment[];
    border?: boolean;
    useConsoleTable?: boolean;
    truncate?: boolean;
    ellipsis?: string;
  } = {},
): string {
  const { columnWidths, align, border = true, useConsoleTable = false, truncate = false, ellipsis = "..." } = options;

  // Use console.table if requested and it's available
  if (useConsoleTable && typeof console.table === "function") {
    // Convert to object array format for console.table
    const tableData = rows.map((row) => {
      const obj: Record<string, string> = {};
      headers.forEach((header, i) => {
        obj[header] = row[i] || "";
      });
      return obj;
    });

    // console.table outputs directly, so return a placeholder
    console.table(tableData);
    return ""; // console.table has no return value
  }

  // Calculate column widths if not provided
  const widths =
    columnWidths ||
    headers.map((header, i) => {
      const maxContentWidth = Math.max(header.length, ...rows.map((row) => (row[i] || "").length));
      return maxContentWidth + 2; // Add padding
    });

  const alignments = align || headers.map(() => "left" as Alignment);

  const result: string[] = [];

  // Format row
  const formatRow = (cells: string[]) => {
    const formattedCells = cells.map((cell, i) => {
      let content = cell;
      const maxWidth = widths[i] || 10;

      // Apply truncation if enabled and content exceeds width (accounting for padding)
      if (truncate && content.length > maxWidth - 2) {
        content = truncateWithEllipsis(content, maxWidth - 2, ellipsis);
      }

      return padText(` ${content} `, maxWidth, alignments[i] || "left");
    });
    return border ? `|${formattedCells.join("|")}|` : formattedCells.join(" ");
  };

  // Top border
  if (border) {
    result.push(
      line(
        "-",
        widths.reduce((sum, w) => sum + w, widths.length + 1),
      ),
    );
  }

  // Headers
  result.push(formatRow(headers));

  // Header separator
  if (border) {
    result.push(
      line(
        "-",
        widths.reduce((sum, w) => sum + w, widths.length + 1),
      ),
    );
  }

  // Rows
  for (const row of rows) {
    result.push(formatRow(row));
  }

  // Bottom border
  if (border) {
    result.push(
      line(
        "-",
        widths.reduce((sum, w) => sum + w, widths.length + 1),
      ),
    );
  }

  return result.join("\n");
}
