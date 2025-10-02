/**
 * Named symbols and emojis for common CLI patterns
 */

export const symbols = {
  // Status symbols
  success: "✅",
  error: "❌",
  warning: "⚠️",
  info: "ℹ️",
  checkmark: "✓",
  cross: "✗",

  // Action symbols
  arrow: "→",
  rightArrow: "→",
  leftArrow: "←",
  upArrow: "↑",
  downArrow: "↓",

  // List symbols
  bullet: "•",
  dash: "-",
  star: "✱",
  circle: "○",
  filledCircle: "●",

  // Emojis
  clipboard: "📋",
  rocket: "🚀",
  fire: "🔥",
  magnifyingGlass: "🔍",
  alert: "🚨",
  package: "📦",
  wrench: "🔧",
  sparkles: "✨",
} as const;

/**
 * Get a symbol by name
 */
export function symbol(name: keyof typeof symbols): string {
  return symbols[name];
}
