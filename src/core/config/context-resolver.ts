import { dirname, resolve } from "node:path";
import type { DockerBakeConfig, DockerShaConfig, DockerShaTarget } from "../../types.js";

/**
 * Context resolution utility for docker-sha configuration
 */
export class ContextResolver {
  private orckaDirPath: string;
  private config: DockerShaConfig;
  private bakeConfigs: Map<string, DockerBakeConfig> = new Map();

  constructor(dockerShaFilePath: string, config: DockerShaConfig) {
    this.orckaDirPath = dirname(resolve(dockerShaFilePath));
    this.config = config;
  }

  /**
   * Sets parsed bake configurations for context resolution
   */
  setBakeConfigs(bakeConfigs: Map<string, DockerBakeConfig>): void {
    this.bakeConfigs = bakeConfigs;
  }

  /**
   * Gets the orcka context (project context or docker-sha.yml location)
   */
  getOrckaContext(): string {
    return resolve(this.orckaDirPath, this.config.project?.context || ".");
  }

  /**
   * Resolves the context for a specific target based on context_of setting
   */
  resolveTargetContext(targetName: string, target: DockerShaTarget): string {
    const contextOf = target.context_of || "orcka";

    switch (contextOf) {
      case "orcka":
        return this.getOrckaContext();

      case "dockerfile":
        return this.resolveDockerfileContext(targetName);

      case "target":
        return this.resolveBakeTargetContext(targetName);

      case "bake":
        return this.resolveBakeFileContext(targetName);

      default:
        // Fallback to orcka context
        return this.getOrckaContext();
    }
  }

  /**
   * Resolves context to the directory containing the dockerfile for this target
   */
  private resolveDockerfileContext(targetName: string): string {
    const bakeTarget = this.findBakeTarget(targetName);
    if (bakeTarget?.dockerfile) {
      // Get the directory containing the dockerfile
      const dockerfilePath = resolve(this.getOrckaContext(), bakeTarget.dockerfile);
      return dirname(dockerfilePath);
    }
    // Fallback to orcka context if dockerfile not found
    return this.getOrckaContext();
  }

  /**
   * Resolves context to the bake target's context directory
   */
  private resolveBakeTargetContext(targetName: string): string {
    const bakeTarget = this.findBakeTarget(targetName);
    if (bakeTarget?.context) {
      return resolve(this.orckaDirPath, bakeTarget.context);
    }
    // Fallback to orcka context if target context not specified
    return this.getOrckaContext();
  }

  /**
   * Resolves context to the directory containing the bake file that defines this target
   */
  private resolveBakeFileContext(targetName: string): string {
    const bakeFilePath = this.findBakeFileForTarget(targetName);
    if (bakeFilePath) {
      return dirname(resolve(this.getOrckaContext(), bakeFilePath));
    }
    // Fallback to orcka context if bake file not found
    return this.getOrckaContext();
  }

  /**
   * Finds the bake target configuration for a given target name
   */
  private findBakeTarget(targetName: string): { dockerfile?: string; context?: string } | null {
    for (const bakeConfig of this.bakeConfigs.values()) {
      if (bakeConfig.target?.[targetName]) {
        return bakeConfig.target[targetName];
      }
    }
    return null;
  }

  /**
   * Finds the bake file path that contains the given target
   */
  private findBakeFileForTarget(targetName: string): string | null {
    for (const [bakeFilePath, bakeConfig] of this.bakeConfigs.entries()) {
      if (bakeConfig.target?.[targetName]) {
        return bakeFilePath;
      }
    }
    return null;
  }

  /**
   * Resolves a file path relative to the target's context
   */
  resolveFilePath(targetName: string, target: DockerShaTarget, filePath: string): string {
    const targetContext = this.resolveTargetContext(targetName, target);
    return resolve(targetContext, filePath);
  }
}
