/**
 * HCL file generation utilities for docker-sha calculator
 * Handles HCL variable generation, alignment, and formatting
 */

import { type GeneratedService, generateServiceTags } from "../../core/calculation/tag-builder.js";
import type { DockerBakeTarget, DockerShaConfig } from "../../types.js";
import type { Logger } from "../../utils/logging/logger.js";
import { matchServicesToTargets, resolveComposeTags } from "../../docker/compose/compose-tag-resolver.js";

export {
  generateHclVariableName,
  generateTagVersion,
} from "../../core/calculation/tag-builder.js";

/**
 * Result of HCL generation
 */
interface HclGenerationResult {
  hclOutput: string;
  generatedServices: GeneratedService[];
  resolvedTags: Map<string, string>;
}

/**
 * Configuration for HCL generation
 */
export interface HclGenerationConfig {
  /** Whether to include PULL_POLICY variables */
  includePullPolicy?: boolean;
  /** Default pull policy value */
  defaultPullPolicy?: string;
  /** Whether to align variable assignments */
  alignVariables?: boolean;
}

/**
 * Default configuration for HCL generation
 */
export const DEFAULT_HCL_CONFIG: HclGenerationConfig = {
  includePullPolicy: true,
  defaultPullPolicy: "never",
  alignVariables: true,
};

/**
 * Generates the HCL content with calculated image tags.
 */
export async function generateCalculatedHcl(
  config: DockerShaConfig,
  bakeTargets: Record<string, DockerBakeTarget>,
  servicesInOrder: string[],
  projectDir: string,
  logger: Logger,
  buildHashInputFn: (
    bakeTarget: DockerBakeTarget,
    calculateOn: import("../../types.js").DockerShaCalculateOnConfig | undefined,
    resolvedTags: Map<string, string>,
    projectDir: string,
    logger: Logger,
    serviceName: string,
  ) => Promise<string>,
  hclConfig: HclGenerationConfig = DEFAULT_HCL_CONFIG,
  composeFiles?: string[],
): Promise<HclGenerationResult> {
  // Resolve compose tags if compose files are provided
  let composeTagMap: Map<string, string> | undefined;
  
  if (composeFiles && composeFiles.length > 0) {
    logger.verbose("Resolving compose file image tags...");
    const composeResult = resolveComposeTags(composeFiles, { applyMerging: true });
    
    if (composeResult.warnings.length > 0) {
      for (const warning of composeResult.warnings) {
        logger.verbose(`Compose tag warning: ${warning}`);
      }
    }
    
    // Match services to bake targets
    const serviceMatches = matchServicesToTargets(composeResult.tags, bakeTargets);
    
    // Create map of service name → compose tag
    composeTagMap = new Map();
    for (const composeTag of composeResult.tags) {
      const targetName = serviceMatches.get(composeTag.serviceName);
      if (targetName) {
        composeTagMap.set(targetName, composeTag.tag);
        logger.verbose(`Matched compose service '${composeTag.serviceName}' → target '${targetName}' with tag '${composeTag.tag}'`);
      }
    }
  }

  const { services: generatedServices, resolvedTags } = await generateServiceTags({
    config,
    bakeTargets,
    servicesInOrder,
    projectDir,
    logger,
    composeTagMap,
    buildHashInput: buildHashInputFn,
  });

  const hclOutput = formatHclOutput(generatedServices, hclConfig);

  return { hclOutput, generatedServices, resolvedTags };
}

/**
 * Generates pull policy variable name from TAG_VER variable name
 */
export function generatePullPolicyVariableName(tagVarName: string): string {
  return tagVarName.replace("_TAG_VER", "_PULL_POLICY");
}

/**
 * Formats HCL output with proper variable alignment
 */
export function formatHclOutput(
  generatedServices: GeneratedService[],
  config: HclGenerationConfig = DEFAULT_HCL_CONFIG,
): string {
  const allVariables: Array<{ name: string; value: string }> = [];

  // Add TAG_VER variables
  for (const service of generatedServices) {
    allVariables.push({
      name: service.varName,
      value: service.imageTag,
    });
  }

  // Add PULL_POLICY variables if enabled
  if (config.includePullPolicy) {
    for (const service of generatedServices) {
      const pullPolicyVarName = generatePullPolicyVariableName(service.varName);
      allVariables.push({
        name: pullPolicyVarName,
        value: config.defaultPullPolicy || "never",
      });
    }
  }

  if (config.alignVariables) {
    return formatAlignedVariables(allVariables);
  } else {
    return formatSimpleVariables(allVariables);
  }
}

/**
 * Formats variables with proper alignment
 */
export function formatAlignedVariables(variables: Array<{ name: string; value: string }>): string {
  // Calculate maximum variable name length for alignment
  const maxVarNameLength = Math.max(...variables.map((variable) => variable.name.length));

  // Format HCL lines with proper alignment
  const alignedHclLines = variables.map((variable) => {
    const padding = " ".repeat(maxVarNameLength - variable.name.length);
    return `${variable.name}${padding} = "${variable.value}"`;
  });

  return alignedHclLines.join("\n");
}

/**
 * Formats variables without alignment (simple format)
 */
export function formatSimpleVariables(variables: Array<{ name: string; value: string }>): string {
  return variables.map((variable) => `${variable.name} = "${variable.value}"`).join("\n");
}

/**
 * Validates HCL generation configuration
 */
export function validateHclConfig(config: HclGenerationConfig): boolean {
  if (config.defaultPullPolicy && typeof config.defaultPullPolicy !== "string") {
    return false;
  }

  return true;
}

/**
 * Creates HCL generation configuration with defaults
 */
export function createHclConfig(overrides: Partial<HclGenerationConfig> = {}): HclGenerationConfig {
  return {
    ...DEFAULT_HCL_CONFIG,
    ...overrides,
  };
}
