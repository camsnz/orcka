import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { DockerBakeTarget, DockerShaConfig, ValidationError } from "../../types";
import { parseHclForValidation } from "../../utils/file/file-utils.js";
import { buildDependencyTree, CyclicDependencyError } from "../dependencies/dependency-calculator.js";

/**
 * Validates bake file dependencies and target existence
 */
export function validateBakeFileDependencies(config: DockerShaConfig, projectDir: string): ValidationError[] {
  const errors: ValidationError[] = [];
  const allBakeTargets: Record<string, DockerBakeTarget> = {};

  // Resolve context directory relative to project directory
  const contextDir = resolve(projectDir, config.project?.context || ".");

  // 1. Load and parse all bake files
  for (const bakeFile of config.project?.bake || []) {
    const bakeFilePath = resolve(contextDir, bakeFile);

    if (!existsSync(bakeFilePath)) {
      errors.push({
        type: "file",
        message: `Bake file not found: ${bakeFile}`,
      });
      continue;
    }

    try {
      // Parse HCL bake file
      const hclResult = parseHclForValidation(bakeFilePath);

      if (!hclResult.success) {
        errors.push({
          type: "file",
          message: `Failed to read bake file ${bakeFile}: ${hclResult.error}`,
        });
        continue;
      }

      const bakeConfig = hclResult.data as {
        target?: Record<string, DockerBakeTarget>;
      };

      // Extract targets from bake file
      if (bakeConfig.target) {
        for (const [targetName, targetConfig] of Object.entries(bakeConfig.target)) {
          if (allBakeTargets[targetName]) {
            errors.push({
              type: "dependency",
              message: `Duplicate bake target '${targetName}' found in bake files.`,
            });
          } else {
            allBakeTargets[targetName] = targetConfig as DockerBakeTarget;
          }
        }
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push({
        type: "file",
        message: `Failed to read or parse bake file ${bakeFile}: ${errorMessage}`,
      });
    }
  }

  // 2. Check that all targets in docker-sha.yml exist in the bake files
  for (const targetName of Object.keys(config.targets)) {
    if (!allBakeTargets[targetName]) {
      errors.push({
        type: "dependency",
        target: targetName,
        message: `Target '${targetName}' not found in any of the specified bake files.`,
      });
    }
  }

  // 3. Check for cyclic dependencies in bake targets
  try {
    buildDependencyTree(allBakeTargets);
    // If we get here without throwing, there are no cycles
  } catch (error) {
    if (error instanceof CyclicDependencyError) {
      errors.push({
        type: "dependency",
        message: `Cyclic dependency found in bake files: ${error.message}`,
      });
    }
  }

  return errors;
}
