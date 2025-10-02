import type { DockerShaConfig, ValidationWarning } from "../../types";

/**
 * Generates warnings for best practices and potential issues
 */
export function generateWarnings(config: DockerShaConfig): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  // Check for targets with only 'always: true' (might be inefficient)
  if (config.targets) {
    for (const [targetName, target] of Object.entries(config.targets)) {
      if (target.calculate_on?.always === true) {
        const hasOtherCriteria = target.calculate_on.files || target.calculate_on.period || target.calculate_on.jq;

        if (!hasOtherCriteria) {
          warnings.push({
            type: "performance",
            target: targetName,
            message: `Target '${targetName}' uses 'always: true' without other criteria. Consider using period, files, or jq for better performance.`,
          });
        }
      }

      // Warn about very short periods
      if (target.calculate_on?.period) {
        if (typeof target.calculate_on.period === "object" && "unit" in target.calculate_on.period) {
          const period = target.calculate_on.period;
          if (period.unit === "minutes" || (period.unit === "hours" && period.number === 1)) {
            warnings.push({
              type: "performance",
              target: targetName,
              message: `Target '${targetName}' has a very short period (${period.number} ${period.unit}). This may cause frequent rebuilds.`,
            });
          }
        } else if (typeof target.calculate_on.period === "string" && target.calculate_on.period === "hourly") {
          warnings.push({
            type: "performance",
            target: targetName,
            message: `Target '${targetName}' uses hourly period. This may cause frequent rebuilds.`,
          });
        }
      }
    }
  }

  return warnings;
}
