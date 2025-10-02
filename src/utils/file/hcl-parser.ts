import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

// HCL parsing using @cdktf/hcl2json with proper WASM dependency management
import { parse as hclParse } from "@cdktf/hcl2json";

import type { DockerBakeConfig, DockerBakeTarget } from "../../types.js";

/**
 * Result of HCL parsing operation
 */
interface HclParseResult {
  success: boolean;
  data?: DockerBakeConfig;
  error?: string;
}

/**
 * Options for HCL parsing
 */
interface HclParseOptions {
  /** Whether to use fallback parsing when HCL parser is disabled */
  useFallback?: boolean;
  /** Whether to log warnings about disabled parsing */
  silent?: boolean;
}

/**
 * Centralized HCL file parser with fallback support
 *
 * This module consolidates all HCL parsing logic and provides a clean interface
 * for parsing HCL files throughout the application. When HCL parsing is disabled
 * due to WASM dependency issues, it provides safe fallbacks.
 *
 * @example
 * ```typescript
 * const result = await parseHclFile('/path/to/docker-bake.hcl');
 * if (result.success && result.data) {
 *   // Use parsed HCL data
 *   console.log(result.data.target);
 * }
 * ```
 */
export class HclParser {
  private static isHclParsingEnabled = true;

  /**
   * Parse an HCL file and return structured data
   *
   * @param filePath - Path to the HCL file
   * @param fileName - Optional filename for metadata (used by HCL parser)
   * @param options - Parsing options
   * @returns Promise resolving to parse result
   */
  static async parseHclFile(
    filePath: string,
    fileName?: string,
    options: HclParseOptions = {},
  ): Promise<HclParseResult> {
    // Check if file exists
    if (!existsSync(filePath)) {
      return {
        success: false,
        error: `HCL file not found: ${filePath}`,
      };
    }

    try {
      const content = readFileSync(filePath, "utf-8");
      return await HclParser.parseHclContent(content, fileName || filePath, options);
    } catch (error) {
      return {
        success: false,
        error: `Failed to read HCL file: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Parse HCL content string and return structured data
   *
   * @param content - HCL content as string
   * @param fileName - Filename for metadata (used by HCL parser)
   * @param options - Parsing options
   * @returns Promise resolving to parse result
   */
  static async parseHclContent(
    _content: string,
    fileName: string,
    options: HclParseOptions = {},
  ): Promise<HclParseResult> {
    const { useFallback = true, silent = false } = options;

    if (HclParser.isHclParsingEnabled) {
      try {
        const parsedHcl = (await hclParse(fileName, _content)) as {
          target?: Record<string, DockerBakeTarget>;
          variable?: Record<string, unknown>;
        };

        return {
          success: true,
          data: HclParser.normalizeHclData(parsedHcl),
        };

        // Temporary: HCL parsing is disabled
        // throw new Error(
        //   "HCL parsing is temporarily disabled due to WASM dependency issues"
        // );
      } catch (error) {
        if (!silent) {
          console.warn(`HCL parsing failed for ${fileName}: ${error instanceof Error ? error.message : String(error)}`);
        }

        if (useFallback) {
          return HclParser.getFallbackResult(fileName, silent);
        }

        return {
          success: false,
          error: `HCL parsing failed: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    } else {
      if (useFallback) {
        return HclParser.getFallbackResult(fileName, silent);
      }
      return {
        success: false,
        error: "HCL parsing is disabled due to WASM dependency issues",
      };
    }
  }

  /**
   * Parse multiple HCL files and return a map of results
   *
   * @param filePaths - Array of HCL file paths
   * @param options - Parsing options
   * @returns Promise resolving to map of filename to parse result
   */
  static async parseMultipleHclFiles(
    filePaths: string[],
    options: HclParseOptions = {},
  ): Promise<Map<string, HclParseResult>> {
    const results = new Map<string, HclParseResult>();

    for (const filePath of filePaths) {
      const fileName = filePath.split("/").pop() || filePath;
      const result = await HclParser.parseHclFile(filePath, fileName, options);
      results.set(fileName, result);
    }

    return results;
  }

  /**
   * Parse HCL files from a directory with a specific pattern
   *
   * @param contextDir - Directory to search in
   * @param fileNames - Array of filenames to parse
   * @param options - Parsing options
   * @returns Promise resolving to map of filename to parse result
   */
  static async parseHclFilesFromContext(
    contextDir: string,
    fileNames: string[],
    options: HclParseOptions = {},
  ): Promise<Map<string, HclParseResult>> {
    const results = new Map<string, HclParseResult>();

    for (const fileName of fileNames) {
      const filePath = resolve(contextDir, fileName);
      const result = await HclParser.parseHclFile(filePath, fileName, options);
      results.set(fileName, result);
    }

    return results;
  }

  /**
   * Check if HCL parsing is currently enabled
   */
  static isParsingEnabled(): boolean {
    return HclParser.isHclParsingEnabled;
  }

  /**
   * Enable or disable HCL parsing (for testing or when WASM issues are resolved)
   */
  static setParsingEnabled(enabled: boolean): void {
    HclParser.isHclParsingEnabled = enabled;
  }

  /**
   * Normalize HCL parser output to consistent format
   *
   * The HCL parser sometimes returns targets as arrays, this normalizes the structure
   */
  private static normalizeHclData(parsedHcl: Record<string, unknown>): DockerBakeConfig {
    const bakeConfig: DockerBakeConfig = {};

    if (parsedHcl?.target) {
      bakeConfig.target = {}; // Initialize target object once
      for (const [targetName, targetConfig] of Object.entries(parsedHcl.target)) {
        // Skip invalid target names (HCL parser artifacts)
        if (targetName.includes(")") || targetName.includes("(")) {
          continue;
        }

        // Extract target data from array if needed
        const targetData = Array.isArray(targetConfig) ? targetConfig[0] : targetConfig;
        if (targetData && typeof targetData === "object") {
          bakeConfig.target[targetName] = targetData as DockerBakeTarget;
        }
      }
    }

    // Handle variables section
    if (parsedHcl?.variable) {
      bakeConfig.variable = {}; // Initialize variable object
      for (const [variableName, variableConfig] of Object.entries(parsedHcl.variable)) {
        // Skip invalid variable names (HCL parser artifacts)
        if (variableName.includes(")") || variableName.includes("(")) {
          continue;
        }

        // Extract variable data from array if needed
        const variableData = Array.isArray(variableConfig) ? variableConfig[0] : variableConfig;
        if (variableData && typeof variableData === "object") {
          bakeConfig.variable[variableName] = variableData as Record<string, unknown>;
        }
      }
    }

    return bakeConfig;
  }

  /**
   * Provide fallback result when HCL parsing is disabled
   */
  private static getFallbackResult(fileName: string, silent: boolean): HclParseResult {
    if (!silent) {
      console.warn(`HCL parsing disabled for ${fileName}, using empty fallback`);
    }

    return {
      success: true,
      data: { target: {} },
    };
  }
}

/**
 * Legacy compatibility: Extract bake configs from HCL parsing results
 */
export function extractBakeConfigs(parseResults: Map<string, HclParseResult>): Map<string, DockerBakeConfig> {
  const bakeConfigs = new Map<string, DockerBakeConfig>();
  for (const [fileName, result] of parseResults) {
    if (result.success && result.data) {
      bakeConfigs.set(fileName, result.data);
    } else {
      bakeConfigs.set(fileName, { target: {} });
    }
  }
  return bakeConfigs;
}
