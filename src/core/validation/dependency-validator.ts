import { execSync } from "node:child_process";
import type { DockerShaConfig, ValidationError } from "../../types";

/**
 * Validates dependencies and external requirements
 */
export function validateDependencies(config: DockerShaConfig, _filePath: string): ValidationError[] {
  const errors: ValidationError[] = [];

  // Check if jq is available for targets that use it
  const targetsUsingJq = Object.entries(config.targets || {}).filter(([, target]) => target.calculate_on?.jq);

  if (targetsUsingJq.length > 0) {
    try {
      execSync("which jq", { stdio: "ignore" });
    } catch {
      errors.push({
        type: "dependency",
        message: "jq command not found. Install jq to use jq-based calculate_on criteria.",
      });
    }
  }

  return errors;
}
