/**
 * Simple UI elements and status indicators
 */

/**
 * Create a status line with icon
 */
export function statusLine(type: "success" | "error" | "warning" | "info", message: string): string {
  const icons = {
    success: "✅",
    error: "❌",
    warning: "⚠️",
    info: "ℹ️",
  };
  return `${icons[type]} ${message}`;
}

/**
 * Create a bulleted list item
 */
export function bullet(text: string, indent: number = 2): string {
  return `${" ".repeat(indent)}• ${text}`;
}

/**
 * Create a numbered list item
 */
export function numbered(text: string, number: number, indent: number = 2): string {
  return `${" ".repeat(indent)}${number}. ${text}`;
}

/**
 * Create a dash list item
 */
export function dash(text: string, indent: number = 4): string {
  return `${" ".repeat(indent)}- ${text}`;
}

/**
 * Create a key-value display line
 */
export function keyValue(
  key: string,
  value: string,
  options: { keyWidth?: number; separator?: string; indent?: number } = {},
): string {
  const { keyWidth = 20, separator = ":", indent: indentSize = 0 } = options;
  const paddedKey = key.padEnd(keyWidth);
  const indentStr = " ".repeat(indentSize);
  return `${indentStr}${paddedKey}${separator} ${value}`;
}

/**
 * Create a section header
 */
export function section(title: string, char: string = "="): string {
  return `\n${title}\n${char.repeat(title.length)}`;
}

/**
 * Create a child list item (indented under a parent)
 */
export function child(text: string, indent: number = 5, prefix: string = "→"): string {
  return `${" ".repeat(indent)}${prefix} ${text}`;
}
