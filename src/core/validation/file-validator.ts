import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { DockerBakeConfig, DockerShaConfig, ValidationError } from "../../types";
import { ContextResolver } from "../config/context-resolver.js";

/**
 * Validates file existence for docker-sha configuration
 */
export function validateFileExistence(
  config: DockerShaConfig,
  filePath: string,
  bakeConfigs?: Map<string, DockerBakeConfig>,
): ValidationError[] {
  const errors: ValidationError[] = [];
  const contextResolver = new ContextResolver(filePath, config);

  if (bakeConfigs) {
    contextResolver.setBakeConfigs(bakeConfigs);
  }

  const orckaContext = contextResolver.getOrckaContext();

  // Check bake files exist (relative to orcka context directory)
  if (config.project?.bake) {
    for (const bakeFile of config.project.bake) {
      const bakeFilePath = resolve(orckaContext, bakeFile);
      if (!existsSync(bakeFilePath)) {
        errors.push({
          type: "file",
          message: `Bake file not found: ${bakeFile}`,
          path: bakeFilePath,
        });
      }
    }
  }

  // Check files in calculate_on.files exist (relative to target's resolved context)
  if (config.targets) {
    for (const [targetName, target] of Object.entries(config.targets)) {
      if (target.calculate_on?.files) {
        for (const file of target.calculate_on.files) {
          const fullPath = contextResolver.resolveFilePath(targetName, target, file);
          if (!existsSync(fullPath)) {
            errors.push({
              type: "file",
              target: targetName,
              message: `File not found: ${file}`,
              path: fullPath,
            });
          }
        }
      }
    }
  }

  return errors;
}
