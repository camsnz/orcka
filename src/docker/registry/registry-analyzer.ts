/**
 * Registry Analyzer
 * 
 * Analyzes Docker registries from image references, checks authentication,
 * and assesses connectivity. Best-effort approach - reports what we can determine.
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface RegistryInfo {
  name: string;              // Registry hostname (e.g., docker.io, ghcr.io)
  authenticated: boolean;    // Has auth credentials in config
  accessible: boolean;       // Can connect and auth (checked via manifest)
  imageCount: number;        // Number of images from this registry
  localCount: number;        // Number of images available locally
  error?: string;           // Error message if inaccessible
}

export interface RegistryAnalysisResult {
  registries: RegistryInfo[];
  totalImages: number;
  totalLocal: number;
  errors: string[];
}

/**
 * Parse registry name from image reference
 * Handles:
 * - docker.io/library/nginx:latest → docker.io
 * - ghcr.io/owner/repo:tag → ghcr.io
 * - localhost:5000/app:v1 → localhost:5000
 * - nginx:latest → docker.io (default)
 */
export function parseRegistryFromImage(imageRef: string): string {
  // Split by slash first to get segments
  const parts = imageRef.split("/");
  
  if (parts.length === 1) {
    // No slash = Docker Hub official image (library/*)
    return "docker.io";
  }
  
  const firstPart = parts[0];
  
  // If first part looks like a registry (has dot or colon for host:port), it's a registry
  // Note: We check for dot OR colon, but DON'T split on colon yet (could be port)
  if (firstPart.includes(".") || firstPart.includes(":")) {
    return firstPart;
  }
  
  // Otherwise it's Docker Hub (user/repo format)
  return "docker.io";
}

/**
 * Check if registry has authentication in Docker config
 */
export function checkRegistryAuth(registryName: string): boolean {
  try {
    const configPath = getDockerConfigPath();
    
    if (!existsSync(configPath)) {
      return false;
    }
    
    const configContent = readFileSync(configPath, "utf-8");
    const config = JSON.parse(configContent);
    
    // Check direct auth entries
    if (config.auths && typeof config.auths === "object") {
      // Check exact match and common variations
      const registryVariations = [
        registryName,
        `https://${registryName}`,
        `http://${registryName}`,
      ];
      
      // Docker Hub special cases
      if (registryName === "docker.io") {
        registryVariations.push("https://index.docker.io/v1/");
        registryVariations.push("https://index.docker.io/v2/");
      }
      
      for (const variation of registryVariations) {
        if (variation in config.auths) {
          const authEntry = config.auths[variation];
          // Check if auth entry has actual credentials (not just empty object)
          if (authEntry && (authEntry.auth || authEntry.username)) {
            return true;
          }
        }
      }
    }
    
    // If using credential store/helper, assume authenticated if entry exists
    if (config.credsStore || config.credHelpers) {
      return true;
    }
    
    return false;
  } catch {
    return false;
  }
}

/**
 * Check if registry is accessible by attempting manifest inspection
 * This is a best-effort check - uses a well-known small image
 */
export function checkRegistryAccessibility(registryName: string): { accessible: boolean; error?: string } {
  try {
    // Use registry-specific probe images
    const probeImage = getRegistryProbeImage(registryName);
    
    // Try to inspect manifest (no pull, just check if we can access)
    execSync(`docker manifest inspect ${probeImage}`, {
      stdio: "pipe",
      timeout: 5000,
    });
    
    return { accessible: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    
    // Parse common error types
    if (errorMsg.includes("unauthorized") || errorMsg.includes("401")) {
      return { accessible: false, error: "unauthorized" };
    }
    if (errorMsg.includes("not found") || errorMsg.includes("404")) {
      return { accessible: false, error: "not found" };
    }
    if (errorMsg.includes("timeout") || errorMsg.includes("connection")) {
      return { accessible: false, error: "connection failed" };
    }
    
    return { accessible: false, error: "unknown" };
  }
}

/**
 * Get appropriate probe image for registry
 */
function getRegistryProbeImage(registryName: string): string {
  // Use well-known tiny images for each registry
  const probes: Record<string, string> = {
    "docker.io": "docker.io/library/hello-world:latest",
    "ghcr.io": "ghcr.io/github/super-linter:latest",
    "gcr.io": "gcr.io/google-containers/pause:latest",
    "quay.io": "quay.io/prometheus/node-exporter:latest",
  };
  
  return probes[registryName] || `${registryName}/probe:latest`;
}

/**
 * Get Docker config path (respects DOCKER_CONFIG env var)
 */
function getDockerConfigPath(): string {
  const dockerConfig = process.env.DOCKER_CONFIG;
  if (dockerConfig) {
    return join(dockerConfig, "config.json");
  }
  return join(homedir(), ".docker", "config.json");
}

/**
 * Check if image exists locally
 */
export function checkImageLocal(imageRef: string): boolean {
  try {
    execSync(`docker image inspect ${imageRef}`, {
      stdio: "pipe",
      timeout: 2000,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Analyze registries from a list of image references
 */
export function analyzeRegistries(imageReferences: string[]): RegistryAnalysisResult {
  const errors: string[] = [];
  const registryMap = new Map<string, {
    images: string[];
    localImages: string[];
  }>();
  
  // Group images by registry
  for (const imageRef of imageReferences) {
    const registryName = parseRegistryFromImage(imageRef);
    
    if (!registryMap.has(registryName)) {
      registryMap.set(registryName, { images: [], localImages: [] });
    }
    
    const registryData = registryMap.get(registryName)!;
    registryData.images.push(imageRef);
    
    // Check if image is local
    if (checkImageLocal(imageRef)) {
      registryData.localImages.push(imageRef);
    }
  }
  
  // Analyze each registry
  const registries: RegistryInfo[] = [];
  
  for (const [registryName, data] of registryMap.entries()) {
    try {
      const authenticated = checkRegistryAuth(registryName);
      const accessCheck = checkRegistryAccessibility(registryName);
      
      registries.push({
        name: registryName,
        authenticated,
        accessible: accessCheck.accessible,
        imageCount: data.images.length,
        localCount: data.localImages.length,
        error: accessCheck.error,
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      errors.push(`Failed to analyze registry ${registryName}: ${errorMsg}`);
      
      registries.push({
        name: registryName,
        authenticated: false,
        accessible: false,
        imageCount: data.images.length,
        localCount: data.localImages.length,
        error: errorMsg,
      });
    }
  }
  
  // Sort by image count (most used first)
  registries.sort((a, b) => b.imageCount - a.imageCount);
  
  const totalImages = imageReferences.length;
  const totalLocal = registries.reduce((sum, reg) => sum + reg.localCount, 0);
  
  return {
    registries,
    totalImages,
    totalLocal,
    errors,
  };
}

/**
 * Format registry status for display
 */
export function formatRegistryStatus(info: RegistryInfo): string {
  if (info.accessible) {
    return info.authenticated ? "✅ authenticated" : "🔓 accessible";
  }
  
  if (info.error === "unauthorized") {
    return "🔒 unauthorized";
  }
  
  if (info.error === "not found") {
    return "❓ not found";
  }
  
  if (info.error === "connection failed") {
    return "⚠️ unreachable";
  }
  
  return "❌ inaccessible";
}

