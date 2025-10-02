/**
 * Configuration Discovery for orcka
 * Auto-detects orcka configuration files in the current directory
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Logger } from "../../utils/logging/logger.js";

/**
 * Supported configuration file names in order of preference
 * Based on TARGET_BEHAVIOUR.md specification
 */
export const CONFIG_FILE_NAMES = [
  "orcka.yaml",
  "orcka.yml",
  "orcka.hcl",
  "docker-orcka.yaml",
  "docker-orcka.yml",
  "docker-orcka.hcl",
] as const;

type ConfigFileName = (typeof CONFIG_FILE_NAMES)[number];

interface ConfigDiscoveryResult {
  found: boolean;
  filePath?: string;
  fileName?: ConfigFileName;
  searchedPaths: string[];
}

/**
 * Discovers orcka configuration files in the specified directory
 */
export class ConfigDiscovery {
  private logger?: Logger;

  constructor(logger?: Logger) {
    this.logger = logger;
  }

  /**
   * Find the first available configuration file in the given directory
   */
  findConfigFile(searchDir = "."): ConfigDiscoveryResult {
    const searchedPaths: string[] = [];

    this.logger?.verbose(`🔍 Searching for orcka configuration files in: ${searchDir}`);

    for (const fileName of CONFIG_FILE_NAMES) {
      const filePath = join(searchDir, fileName);
      searchedPaths.push(filePath);

      this.logger?.verbose(`  Checking: ${fileName}`);

      if (existsSync(filePath)) {
        this.logger?.verbose(`  ✅ Found: ${fileName}`);
        return {
          found: true,
          filePath,
          fileName,
          searchedPaths,
        };
      } else {
        this.logger?.verbose(`  ❌ Not found: ${fileName}`);
      }
    }

    this.logger?.verbose(`❌ No orcka configuration files found in ${searchDir}`);

    return {
      found: false,
      searchedPaths,
    };
  }

  /**
   * Get a user-friendly error message when no config file is found
   */
  getNotFoundMessage(searchDir = "."): string {
    const fileList = CONFIG_FILE_NAMES.map((name) => `  - ${name}`).join("\n");

    return `No orcka configuration file found in ${searchDir}.

Searched for:
${fileList}

Please create one of these files or specify --file <path> to use a custom location.

Example minimal configuration:
---
project:
  name: my-project
  context: .
  bake:
    - docker-bake.hcl

targets:
  my-service:
    calculate_on:
      always: true
---`;
  }

  /**
   * Validate that the discovered file is readable and appears to be valid
   */
  validateConfigFile(filePath: string): { valid: boolean; error?: string } {
    try {
      if (!existsSync(filePath)) {
        return { valid: false, error: `File does not exist: ${filePath}` };
      }

      // Basic file extension validation
      const supportedExtensions = [".yaml", ".yml", ".hcl"];
      const hasValidExtension = supportedExtensions.some((ext) => filePath.endsWith(ext));

      if (!hasValidExtension) {
        return {
          valid: false,
          error: `Unsupported file extension. Expected: ${supportedExtensions.join(", ")}`,
        };
      }

      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: `Error validating config file: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}

/**
 * Convenience function for simple config discovery
 */
export function findOrckaConfig(searchDir = ".", logger?: Logger): ConfigDiscoveryResult {
  const discovery = new ConfigDiscovery(logger);
  return discovery.findConfigFile(searchDir);
}

/**
 * Legacy compatibility function - maintains existing behavior
 */
export function findDockerShaFile(searchDir: string): string | null {
  const discovery = new ConfigDiscovery();
  const result = discovery.findConfigFile(searchDir);
  return result.found && result.filePath ? result.filePath : null;
}
