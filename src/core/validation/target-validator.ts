/**
 * Target validation utilities for docker-sha calculator
 * Validates that targets in docker-sha.yml have corresponding bake file targets
 */

import type { DockerBakeTarget, DockerShaConfig } from "../../types.js";

/**
 * Parsed bake file configuration from @cdktf/hcl2json
 */
export interface ParsedBakeConfig {
  target?: Record<string, DockerBakeTarget>;
  variable?: Record<string, unknown>;
}

/**
 * Validates that each target in docker-sha.yml has a corresponding target in the bake files
 * and that generated TAG_VER variables are declared in the bake files.
 *
 * ARCHITECTURE NOTE: Uses parsed HCL objects from @cdktf/hcl2json instead of regex parsing
 */
export function validateTargetsAndVariables(
  config: DockerShaConfig,
  allBakeTargets: Record<string, DockerBakeTarget>,
  bakeConfigs: Map<string, ParsedBakeConfig>,
): string[] {
  const errors: string[] = [];

  for (const [targetName] of Object.entries(config.targets)) {
    // Check if target exists in bake files
    if (!allBakeTargets[targetName]) {
      errors.push(`Target '${targetName}' not found in any bake file`);
      continue;
    }

    // Generate the expected TAG_VER variable name
    const hclVarName = generateHclVariableName(targetName);
    const expectedVarName = `${hclVarName}_TAG_VER`;

    // Check if the TAG_VER variable is declared in any bake file
    if (!isVariableDeclaredInBakeConfigs(expectedVarName, bakeConfigs)) {
      errors.push(
        `Variable '${expectedVarName}' not found in any bake file. ` +
          `Please declare: variable "${expectedVarName}" { default = "" }`,
      );
    }
  }

  return errors;
}

/**
 * Generates HCL variable name from target name
 * Converts kebab-case to UPPER_SNAKE_CASE
 */
export function generateHclVariableName(targetName: string): string {
  return targetName.replace(/-/g, "_").toUpperCase();
}

/**
 * Checks if a variable is declared in any of the parsed bake configurations
 * Uses @cdktf/hcl2json parsed objects instead of regex parsing
 */
export function isVariableDeclaredInBakeConfigs(
  variableName: string,
  bakeConfigs: Map<string, ParsedBakeConfig>,
): boolean {
  for (const bakeConfig of bakeConfigs.values()) {
    if (bakeConfig.variable && variableName in bakeConfig.variable) {
      return true;
    }
  }

  return false;
}

/**
 * @deprecated Use isVariableDeclaredInBakeConfigs instead
 * Legacy function that uses regex parsing - kept for backward compatibility
 */
export function isVariableDeclaredInBakeFiles(variableName: string, bakeFileContents: Map<string, string>): boolean {
  const variablePattern = new RegExp(`variable\\s+"${variableName}"\\s*\\{`, "i");

  for (const content of bakeFileContents.values()) {
    if (variablePattern.test(content)) {
      return true;
    }
  }

  return false;
}

/**
 * Validates that all required targets exist in bake files
 */
export function validateTargetExistence(
  config: DockerShaConfig,
  allBakeTargets: Record<string, DockerBakeTarget>,
): string[] {
  const errors: string[] = [];

  for (const [targetName] of Object.entries(config.targets)) {
    if (!allBakeTargets[targetName]) {
      errors.push(`Target '${targetName}' not found in any of the specified bake files.`);
    }
  }

  return errors;
}
