/**
 * Clout - Command Line OUT formatting utility
 *
 * Provides comprehensive text formatting and layout functions for rich CLI output.
 */

import { bullet, child, dash, keyValue, numbered, section, statusLine } from "./elements";
import { banner, box, formatText, heading, indent, list, paragraph, table } from "./formatters";
import { symbol, symbols } from "./symbols";
import { getTerminalWidth, line } from "./utils";

/**
 * Main Clout export with all formatting functions
 */
export const Clout = {
  // Basic functions
  line,
  banner,
  box,
  paragraph,
  heading,
  indent,
  list,
  table,

  // Status and formatting helpers
  statusLine,
  bullet,
  numbered,
  dash,
  child,
  keyValue,
  section,

  // Symbols and emojis
  symbols,
  symbol,

  // Text formatting
  formatText,

  // Utility functions
  getTerminalWidth,
} as const;

// Re-export commonly used formatting functions
export { banner, box, formatText, heading, list, paragraph } from "./formatters";
export { symbol, symbols } from "./symbols";
// Internal utilities (bullet, child, dash, keyValue, numbered, section, statusLine, indent, table)
// are available via the Clout namespace but not exported individually
// to reduce API surface area. Use Clout.bullet(), Clout.statusLine(), etc.
// Export types
export * from "./types";
export { getTerminalWidth, line } from "./utils";
