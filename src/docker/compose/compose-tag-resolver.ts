/**
 * Compose Tag Resolver
 * 
 * Extracts and resolves image tags from docker-compose files.
 * Handles:
 * - Static tags: myapp:v1.0
 * - Env vars with defaults: myapp:${VERSION-latest}
 * - Implicit latest: myapp (becomes myapp:latest)
 * - Variable substitution: myapp:${VERSION} (uses process.env)
 */

import { readFileSync } from "node:fs";
import { parse } from "yaml";

export interface ComposeImageTag {
  serviceName: string;
  imageName: string;
  tag: string;           // Resolved tag value
  originalTag: string;   // As specified in compose file
  hasVariables: boolean; // true if contains ${...}
}

export interface ComposeTagResolutionResult {
  tags: ComposeImageTag[];
  warnings: string[];
}

interface ComposeService {
  image?: string;
  build?: unknown;
  [key: string]: unknown;
}

interface ComposeConfig {
  services?: Record<string, ComposeService>;
  [key: string]: unknown;
}

interface ResolveOptions {
  env?: Record<string, string>;
  applyMerging?: boolean;
}

/**
 * Extracts and resolves image tags from compose files
 */
export function resolveComposeTags(
  composeFiles: string[],
  options: ResolveOptions = {}
): ComposeTagResolutionResult {
  const result: ComposeTagResolutionResult = {
    tags: [],
    warnings: [],
  };

  if (composeFiles.length === 0) {
    return result;
  }

  try {
    // Parse all compose files
    const configs = composeFiles.map((file) => parseComposeFile(file, result.warnings));

    // Merge configs if requested (later files override earlier)
    const mergedConfig = options.applyMerging 
      ? mergeComposeConfigs(configs) 
      : configs[0];

    if (!mergedConfig?.services) {
      result.warnings.push("No services found in compose files");
      return result;
    }

    // Extract and resolve tags from services
    // Filter out undefined values from process.env
    const processEnvFiltered: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (value !== undefined) {
        processEnvFiltered[key] = value;
      }
    }
    const env = { ...processEnvFiltered, ...(options.env || {}) };
    
    for (const [serviceName, service] of Object.entries(mergedConfig.services)) {
      if (!service.image) {
        // Skip services that build from Dockerfile (no image tag)
        continue;
      }

      const imageTag = extractImageTag(serviceName, service.image, env);
      if (imageTag) {
        result.tags.push(imageTag);
      } else {
        result.warnings.push(`Could not parse image for service: ${serviceName}`);
      }
    }

    return result;
  } catch (error) {
    result.warnings.push(`Error resolving compose tags: ${error instanceof Error ? error.message : String(error)}`);
    return result;
  }
}

/**
 * Parse a single compose file
 */
function parseComposeFile(filePath: string, warnings: string[]): ComposeConfig | null {
  try {
    const content = readFileSync(filePath, "utf-8");
    return parse(content) as ComposeConfig;
  } catch (error) {
    warnings.push(`Failed to parse ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/**
 * Merge multiple compose configs (later overrides earlier)
 */
function mergeComposeConfigs(configs: (ComposeConfig | null)[]): ComposeConfig {
  const merged: ComposeConfig = { services: {} };

  for (const config of configs) {
    if (!config) continue;

    if (config.services) {
      merged.services = {
        ...merged.services,
        ...config.services,
      };
    }
  }

  return merged;
}

/**
 * Extract and resolve image tag from service image string
 */
function extractImageTag(
  serviceName: string,
  imageString: string,
  env: Record<string, string>
): ComposeImageTag | null {
  // Check if it contains variables
  const hasVariables = imageString.includes("${") || imageString.includes("$");

  // Parse original (unresolved) tag first
  const originalLastColon = findTagColonIndex(imageString);
  const originalTag = originalLastColon === -1 
    ? "latest"
    : imageString.substring(originalLastColon + 1);

  // Now resolve environment variables in the full image string
  const resolvedImage = resolveEnvVars(imageString, env);
  
  // Parse resolved image name and tag
  const lastColonIndex = findTagColonIndex(resolvedImage);
  
  let imageName: string;
  let tag: string;

  if (lastColonIndex === -1) {
    // No tag specified, default to 'latest'
    imageName = resolvedImage;
    tag = "latest";
  } else {
    imageName = resolvedImage.substring(0, lastColonIndex);
    tag = resolvedImage.substring(lastColonIndex + 1);
  }

  return {
    serviceName,
    imageName,
    tag,
    originalTag,
    hasVariables,
  };
}

/**
 * Find the index of the colon that separates image name from tag
 * (not the colon in port numbers or registry URLs)
 */
function findTagColonIndex(imageString: string): number {
  // Strategy: Find the last colon that's followed by valid tag characters
  // Valid tag chars: alphanumeric, dots, dashes, underscores
  // Invalid after colon: more slashes (means it's part of host:port)
  
  const lastColonIndex = imageString.lastIndexOf(":");
  if (lastColonIndex === -1) {
    return -1;
  }

  // Check if there's a slash after this colon (means it's a port number)
  const afterColon = imageString.substring(lastColonIndex + 1);
  if (afterColon.includes("/")) {
    // This colon is part of host:port, look for the previous one
    const beforeColon = imageString.substring(0, lastColonIndex);
    return findTagColonIndex(beforeColon);
  }

  return lastColonIndex;
}

/**
 * Resolve environment variables in a string
 * Handles: ${VAR}, ${VAR-default}, ${VAR:-default}
 */
function resolveEnvVars(str: string, env: Record<string, string>): string {
  // Match ${VAR}, ${VAR-default}, ${VAR:-default}
  // Pattern explanation:
  // - \$\{ - literal ${
  // - ([^}:-]+) - variable name (no }, :, or -)
  // - (:?-([^}]+))? - optional :- or - followed by default value
  // - \} - literal }
  return str.replace(/\$\{([^}:-]+)(:?-([^}]+))?\}/g, (match, varName, _, defaultValue) => {
    const envValue = env[varName];
    
    if (envValue !== undefined && envValue !== "") {
      return envValue;
    }
    
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    
    // Variable not found and no default - leave as is
    return match;
  });
}

/**
 * Convenience function to get tags for a single compose file
 */
export function resolveComposeTagsFromFile(
  composeFile: string,
  env?: Record<string, string>
): ComposeTagResolutionResult {
  return resolveComposeTags([composeFile], { env });
}

/**
 * Match compose services to bake targets
 * Returns a map of service name → potential target names
 */
export function matchServicesToTargets(
  composeTags: ComposeImageTag[],
  bakeTargets: Record<string, unknown>
): Map<string, string> {
  const matches = new Map<string, string>();

  for (const composeTag of composeTags) {
    // Try exact match first
    if (bakeTargets[composeTag.serviceName]) {
      matches.set(composeTag.serviceName, composeTag.serviceName);
      continue;
    }

    // Try normalized match (dash → underscore)
    const normalized = composeTag.serviceName.replace(/-/g, "_");
    if (bakeTargets[normalized]) {
      matches.set(composeTag.serviceName, normalized);
      continue;
    }

    // Try image-based match (match on image name)
    for (const [targetName, target] of Object.entries(bakeTargets)) {
      if (typeof target === "object" && target !== null && "tags" in target) {
        const tags = (target as { tags?: string[] }).tags || [];
        
        // Check if any bake target tag matches the compose image name
        for (const tag of tags) {
          const bakeImageName = tag.split(":")[0];
          if (bakeImageName === composeTag.imageName) {
            matches.set(composeTag.serviceName, targetName);
            break;
          }
        }
      }
    }
  }

  return matches;
}

