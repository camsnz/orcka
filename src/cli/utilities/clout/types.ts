/**
 * Common types for Clout formatting
 */

export type Alignment = "left" | "center" | "right";

export interface PaddingOptions {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
}

export interface TextOptions {
  width?: number;
  align?: Alignment;
  indent?: number;
  hangingIndent?: number; // Indent for lines after the first
  margin?: PaddingOptions;
}

export interface BannerOptions extends TextOptions {
  divider?: string;
  dividerChar?: string;
  padding?: PaddingOptions;
  borderTop?: boolean;
  borderBottom?: boolean;
}

export interface BoxOptions {
  char?: string;
  width?: number;
  padding?: PaddingOptions;
  align?: Alignment;
}
