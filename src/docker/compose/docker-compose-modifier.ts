/**
 * Docker Compose file modifier for orcka
 * Handles modification of docker-compose.yml files to replace static image tags
 * with TAG_VER variables and add pull_policy fields
 */

import { readFileSync, writeFileSync } from "node:fs";
import { parse, stringify } from "yaml";
import type { Logger } from "../../utils/logging/logger.js";

interface DockerComposeService {
  image?: string;
  pull_policy?: string;
  [key: string]: unknown;
}

interface DockerComposeConfig {
  version?: string;
  services?: Record<string, DockerComposeService>;
  [key: string]: unknown;
}

interface ModifyResult {
  success: boolean;
  modifiedServices: string[];
  errors: string[];
  warnings: string[];
}

/**
 * Modifies a docker-compose.yml file according to orcka requirements:
 * 1. Replace static image tags with TAG_VER variables
 * 2. Add pull_policy fields with PULL_POLICY variables
 */
export async function modifyDockerCompose(filePath: string, logger: Logger): Promise<ModifyResult> {
  const result: ModifyResult = {
    success: false,
    modifiedServices: [],
    errors: [],
    warnings: [],
  };

  try {
    // Read and parse the docker-compose file
    logger.verbose(`Reading docker-compose file: ${filePath}`);
    const fileContent = readFileSync(filePath, "utf-8");
    const config: DockerComposeConfig = parse(fileContent);

    if (!config.services) {
      result.errors.push("No services section found in docker-compose file");
      return result;
    }

    let modified = false;

    // Process each service
    for (const [serviceName, service] of Object.entries(config.services)) {
      logger.verbose(`Processing service: ${serviceName}`);

      const serviceModified = modifyService(serviceName, service, logger);
      if (serviceModified) {
        modified = true;
        result.modifiedServices.push(serviceName);
      }
    }

    if (modified) {
      // Write the modified file back
      const modifiedContent = stringify(config, {
        indent: 2,
        lineWidth: -1, // Disable line wrapping
      });

      writeFileSync(filePath, modifiedContent, "utf-8");
      logger.info(`✅ Modified ${filePath} - updated ${result.modifiedServices.length} services`);
      result.success = true;
    } else {
      logger.info(`ℹ️  No modifications needed for ${filePath}`);
      result.success = true;
    }

    return result;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to modify docker-compose file: ${errorMsg}`);
    result.errors.push(errorMsg);
    return result;
  }
}

/**
 * Modifies a single service according to orcka requirements
 * Returns true if the service was modified
 */
function modifyService(serviceName: string, service: DockerComposeService, logger: Logger): boolean {
  let modified = false;

  // Process image field
  if (service.image) {
    const imageModified = modifyImageField(serviceName, service, logger);
    if (imageModified) {
      modified = true;
    }
  }

  // Add pull_policy field if image exists
  if (service.image) {
    const pullPolicyModified = addPullPolicyField(serviceName, service, logger);
    if (pullPolicyModified) {
      modified = true;
    }
  }

  return modified;
}

/**
 * Modifies the image field to replace static tags with TAG_VER variables
 * Returns true if the image was modified
 */
function modifyImageField(serviceName: string, service: DockerComposeService, logger: Logger): boolean {
  if (!service.image) return false;

  const image = service.image;

  // Skip if image already uses environment variables
  if (image.includes("${") || image.includes("$")) {
    logger.verbose(`Skipping ${serviceName}: image already uses variables`);
    return false;
  }

  // Check if image has a static tag (contains colon)
  const colonIndex = image.lastIndexOf(":");
  if (colonIndex === -1) {
    logger.verbose(`Skipping ${serviceName}: no tag specified in image`);
    return false;
  }

  // Extract image name and tag
  const imageName = image.substring(0, colonIndex);
  const originalTag = image.substring(colonIndex + 1);

  // Skip if tag looks like a port number (all digits)
  if (/^\d+$/.test(originalTag)) {
    logger.verbose(`Skipping ${serviceName}: tag appears to be a port number`);
    return false;
  }

  // Generate TAG_VER variable name
  const varName = serviceName.replace(/-/g, "_").toUpperCase();
  const tagVerVar = `${varName}_TAG_VER`;

  // Replace with TAG_VER variable and original tag as default
  const newImage = `${imageName}:\${${tagVerVar}-${originalTag}}`;
  service.image = newImage;

  logger.verbose(`Modified ${serviceName}: ${image} → ${newImage}`);
  return true;
}

/**
 * Adds or updates pull_policy field with PULL_POLICY variable
 * Returns true if pull_policy was added/modified
 */
function addPullPolicyField(serviceName: string, service: DockerComposeService, logger: Logger): boolean {
  // Generate PULL_POLICY variable name
  const varName = serviceName.replace(/-/g, "_").toUpperCase();
  const pullPolicyVar = `${varName}_PULL_POLICY`;
  const newPullPolicy = `\${${pullPolicyVar}-missing}`;

  // Check if pull_policy already exists and uses variables
  if (service.pull_policy && (service.pull_policy.includes("${") || service.pull_policy.includes("$"))) {
    logger.verbose(`Skipping ${serviceName}: pull_policy already uses variables`);
    return false;
  }

  // Add or update pull_policy
  const oldPullPolicy = service.pull_policy;
  service.pull_policy = newPullPolicy;

  if (oldPullPolicy) {
    logger.verbose(`Modified ${serviceName}: pull_policy ${oldPullPolicy} → ${newPullPolicy}`);
  } else {
    logger.verbose(`Added ${serviceName}: pull_policy = ${newPullPolicy}`);
  }

  return true;
}
