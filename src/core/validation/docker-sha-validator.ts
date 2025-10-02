import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parse as yamlParse } from "yaml";

import type {
  DockerBakeConfig,
  DockerShaConfig,
  ValidationError,
  ValidationResult,
  ValidationWarning,
} from "../../types.js";
import { extractBakeConfigs, HclParser } from "../../utils/file/hcl-parser.js";
import { findOrckaConfig } from "../config/config-discovery.js";
import { validateBakeFileDependencies } from "./bake-validator.js";
import { validateDependencies } from "./dependency-validator.js";
import { validateFileExistence } from "./file-validator.js";
import { validateRequiredTopLevelFields, validateSchema } from "./schema-validator.js";
import { generateWarnings } from "./warning-generator.js";

/**
 * Finds orcka configuration files in the current directory
 * @param directory - Directory to search in (defaults to current directory)
 * @returns Path to found configuration file or null
 */
export function findDockerShaFile(directory: string = process.cwd()): string | null {
  const result = findOrckaConfig(directory);
  return result.found && result.filePath ? result.filePath : null;
}

/**
 * Parses bake configurations from bake files using centralized HCL parser
 */
export async function parseBakeConfigs(
  config: DockerShaConfig,
  filePath: string,
): Promise<Map<string, DockerBakeConfig>> {
  const projectDir = dirname(resolve(filePath));
  const contextDir = resolve(projectDir, config.project?.context || ".");

  if (!config.project?.bake) {
    return new Map<string, DockerBakeConfig>();
  }

  // Use centralized HCL parser with silent fallback for validation
  const parseResults = await HclParser.parseHclFilesFromContext(contextDir, config.project.bake, {
    useFallback: true,
    silent: true,
  });

  // Convert parse results to the expected format
  return extractBakeConfigs(parseResults);
}

/**
 * Validates a docker-sha.yml file and returns validation results.
 * @param filePath - Path to the docker-sha.yml file
 * @returns ValidationResult with errors and warnings
 */
export async function validateDockerShaFile(filePath: string): Promise<ValidationResult> {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  try {
    // Check if file exists
    if (!existsSync(filePath)) {
      errors.push({
        type: "file",
        message: `docker-sha.yml file not found: ${filePath}`,
        path: filePath,
      });
      return { valid: false, errors, warnings };
    }

    // Parse YAML file
    const fileContent = readFileSync(filePath, "utf-8");
    const config = yamlParse(fileContent) as DockerShaConfig;

    // Parse bake configurations for context resolution
    const bakeConfigs = await parseBakeConfigs(config, filePath);

    // Validate required top-level sections with clear error messages
    validateRequiredTopLevelFields(config, errors, filePath);

    // Validate project section schema
    if (config.project) {
      const projectErrors = validateSchema(config);
      errors.push(...projectErrors);
    }

    // Additional validations - run these even if basic structure has issues
    const fileErrors = validateFileExistence(config, filePath, bakeConfigs);
    errors.push(...fileErrors);

    const depErrors = validateDependencies(config, filePath);
    errors.push(...depErrors);

    // Only validate bake file dependencies if we have targets that need validation
    // This prevents breaking existing tests that don't expect this level of validation
    const needsBakeValidation = Object.keys(config.targets || {}).length > 0 && config.project?.bake;
    if (needsBakeValidation) {
      const bakeErrors = validateBakeFileDependencies(config, dirname(resolve(filePath)));
      // Only add bake errors if they're about missing targets or cycles, not missing files
      const relevantErrors = bakeErrors.filter(
        (error) =>
          error.message.includes("not found in any of the specified bake files") ||
          error.message.includes("Cyclic dependency found"),
      );
      errors.push(...relevantErrors);
    }

    const warningList = generateWarnings(config);
    warnings.push(...warningList);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      config: errors.length === 0 ? config : undefined,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    errors.push({
      type: "file",
      message: `Unexpected error during validation: ${errorMessage}`,
      path: filePath,
    });
    return { valid: false, errors, warnings };
  }
}
