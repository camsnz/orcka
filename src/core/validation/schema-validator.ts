import type { DockerShaCalculateOnConfig, DockerShaConfig, ValidationError } from "../../types";

/**
 * Validates the basic schema structure of docker-sha.yml
 */
export function validateSchema(config: DockerShaConfig): ValidationError[] {
  const errors: ValidationError[] = [];

  // Validate project section
  if (config.project) {
    if (!config.project.name) {
      errors.push({
        type: "schema",
        message: "project.name is required",
      });
    }

    // project.context is now optional - defaults to docker-sha.yml location

    if (!config.project.write) {
      errors.push({
        type: "schema",
        message: "project.write is required",
      });
    }

    if (!config.project.bake || !Array.isArray(config.project.bake) || config.project.bake.length === 0) {
      errors.push({
        type: "schema",
        message: "project.bake is required and must be a non-empty array",
      });
    }
  }

  // Validate targets section
  if (config.targets) {
    for (const [targetName, target] of Object.entries(config.targets)) {
      // Skip targets without calculate_on - they just won't be calculated
      if (!target.calculate_on) {
        continue;
      }

      const calculateOn = target.calculate_on as DockerShaCalculateOnConfig;
      const hasValidCriteria =
        calculateOn.always === true ||
        calculateOn.period ||
        (calculateOn.files && Array.isArray(calculateOn.files) && calculateOn.files.length > 0) ||
        (calculateOn.jq && typeof calculateOn.jq === "string");

      if (!hasValidCriteria) {
        errors.push({
          type: "schema",
          target: targetName,
          message: `Target '${targetName}' must have at least one valid calculate_on criteria (always, period, files, or jq)`,
        });
      }

      // Validate period format if present
      if (calculateOn.period) {
        if (typeof calculateOn.period === "string") {
          // String format validation: "hourly" | "weekly" | "monthly" | "yearly"
          const validStringPeriods = ["hourly", "weekly", "monthly", "yearly"];
          if (!validStringPeriods.includes(calculateOn.period)) {
            errors.push({
              type: "schema",
              target: targetName,
              message: `Target '${targetName}' has invalid period format. Valid string periods are: ${validStringPeriods.join(", ")}`,
            });
          }
        } else if (typeof calculateOn.period === "object" && calculateOn.period !== null) {
          // Object format validation
          const period = calculateOn.period as {
            unit?: string;
            number?: number;
          };
          if (!period.unit) {
            errors.push({
              type: "schema",
              target: targetName,
              message: `Target '${targetName}' period must have a unit field`,
            });
          } else if (!["months", "weeks", "days", "hours", "minutes", "none"].includes(period.unit)) {
            errors.push({
              type: "schema",
              target: targetName,
              message: `Target '${targetName}' has invalid period unit '${period.unit}'. Valid units are: months, weeks, days, hours, minutes, none`,
            });
          }

          if (period.unit !== "none" && (typeof period.number !== "number" || period.number <= 0)) {
            errors.push({
              type: "schema",
              target: targetName,
              message: `Target '${targetName}' period must have a positive number when unit is not 'none'`,
            });
          }
        }
      }

      // Validate context_of field if present
      if (target.context_of) {
        const validContextOfValues = ["dockerfile", "orcka", "target", "bake"];
        if (!validContextOfValues.includes(target.context_of)) {
          errors.push({
            type: "schema",
            target: targetName,
            message: `Target '${targetName}' has invalid context_of value '${target.context_of}'. Valid values are: ${validContextOfValues.join(", ")}`,
          });
        }
      }
    }
  }

  return errors;
}

/**
 * Validates required top-level fields with clear error messages
 */
export function validateRequiredTopLevelFields(config: unknown, errors: ValidationError[], filePath: string): void {
  const configObj = config as Record<string, unknown>;

  if (!configObj.project) {
    errors.push({
      type: "schema",
      message: "Missing required 'project' section in docker-sha.yml",
      path: filePath,
    });
  }

  if (!configObj.targets) {
    errors.push({
      type: "schema",
      message: "Missing required 'targets' section in docker-sha.yml",
      path: filePath,
    });
  }
}
