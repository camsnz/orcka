/**
 * Centralized file I/O utilities with consistent error handling
 * Provides reusable file operations with proper error handling
 */

import { existsSync, readFileSync } from "node:fs";
// Note: HCL parsing is now handled by the dedicated HclParser module

/**
 * Result type for file operations that may fail
 */
export type FileResult<T> =
  | {
      success: true;
      data: T;
    }
  | {
      success: false;
      error: string;
      path: string;
    };

/**
 * Safely read a file with error handling
 */
export function safeReadFile(filePath: string): FileResult<string> {
  try {
    if (!existsSync(filePath)) {
      return {
        success: false,
        error: "File not found",
        path: filePath,
      };
    }

    const content = readFileSync(filePath, "utf-8");
    return {
      success: true,
      data: content,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      path: filePath,
    };
  }
}

/**
 * Parse HCL file synchronously for validation purposes using regex extraction
 */
export function parseHclForValidation(filePath: string): FileResult<Record<string, unknown>> {
  const fileResult = safeReadFile(filePath);
  if (!fileResult.success) {
    return fileResult;
  }

  try {
    const hclContent = fileResult.data;
    const parsed: Record<string, unknown> = { target: {} };
    const targetRegex = /target\s+"([^"]+)"\s*\{([^}]*)\}/g;
    let match: RegExpExecArray | null;

    match = targetRegex.exec(hclContent);
    while (match !== null) {
      const targetName = match[1];
      const targetBody = match[2];

      // Parse basic target properties
      const target: Record<string, unknown> = {};

      // Extract dockerfile property
      const dockerfileMatch = targetBody.match(/dockerfile\s*=\s*"([^"]+)"/);
      if (dockerfileMatch) {
        target.dockerfile = dockerfileMatch[1];
      }

      // Extract context property
      const contextMatch = targetBody.match(/context\s*=\s*"([^"]+)"/);
      if (contextMatch) {
        target.context = contextMatch[1];
      }

      // Extract depends_on property
      const dependsOnMatch = targetBody.match(/depends_on\s*=\s*\[([^\]]*)\]/);
      if (dependsOnMatch) {
        const deps = dependsOnMatch[1]
          .split(",")
          .map((dep) => dep.trim().replace(/"/g, ""))
          .filter((dep) => dep.length > 0);
        target.depends_on = deps;
      }

      // Extract contexts property - need to handle nested braces
      // First, find the full target block content including nested braces
      const targetStartIndex = hclContent.indexOf(`target "${targetName}" {`);
      if (targetStartIndex !== -1) {
        let braceCount = 0;
        const startIndex = hclContent.indexOf("{", targetStartIndex) + 1;
        let endIndex = startIndex;

        for (let i = startIndex; i < hclContent.length; i++) {
          if (hclContent[i] === "{") braceCount++;
          else if (hclContent[i] === "}") {
            if (braceCount === 0) {
              endIndex = i;
              break;
            }
            braceCount--;
          }
        }

        const fullTargetBody = hclContent.substring(startIndex, endIndex);
        const contextsMatch = fullTargetBody.match(/contexts\s*=\s*\{([^}]*)\}/);
        if (contextsMatch) {
          const contextsBody = contextsMatch[1];
          const contexts: Record<string, string> = {};

          // Parse key-value pairs in contexts
          const kvRegex = /(\w+)\s*=\s*"([^"]*)"/g;
          let kvMatch: RegExpExecArray | null;
          kvMatch = kvRegex.exec(contextsBody);
          while (kvMatch !== null) {
            contexts[kvMatch[1]] = kvMatch[2];
            kvMatch = kvRegex.exec(contextsBody);
          }

          if (Object.keys(contexts).length > 0) {
            target.contexts = contexts;
          }
        }
      }

      (parsed.target as Record<string, unknown>)[targetName] = target;

      // Continue to next match
      match = targetRegex.exec(hclContent);
    }

    return {
      success: true,
      data: parsed,
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to parse HCL: ${error instanceof Error ? error.message : String(error)}`,
      path: filePath,
    };
  }
}
