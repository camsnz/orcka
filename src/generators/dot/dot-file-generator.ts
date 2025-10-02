/**
 * DOT file generation utilities for visualizing service relationships
 * Generates GraphViz DOT files for dependency visualization
 */

import { writeFileSync } from "node:fs";
import type { DependencyTree } from "../../core/dependencies/dependency-calculator.js";
import type { DockerShaCalculateOnConfig, DockerShaConfig } from "../../types.js";

/**
 * Configuration for DOT file generation
 */
export interface DotFileConfig {
  /** Direction of the graph layout */
  rankDirection?: "LR" | "TB" | "RL" | "BT";
  /** Node shape */
  nodeShape?: string;
  /** Node style */
  nodeStyle?: string;
  /** Color for nodes with always rebuild */
  alwaysColor?: string;
  /** Color for regular nodes */
  defaultColor?: string;
}

/**
 * Default configuration for DOT file generation
 */
export const DEFAULT_DOT_CONFIG: DotFileConfig = {
  rankDirection: "LR",
  nodeShape: "box",
  nodeStyle: "rounded,filled",
  alwaysColor: "lightcoral",
  defaultColor: "lightblue",
};

/**
 * Generates a DOT file for visualizing service relationships and rebuild criteria.
 */
export function generateDotFile(
  config: DockerShaConfig,
  dependencyTree: DependencyTree,
  outPath: string,
  dotConfig: DotFileConfig = DEFAULT_DOT_CONFIG,
): void {
  const lines: string[] = [];

  // DOT file header
  lines.push("digraph ServiceDependencies {");
  lines.push(`  rankdir=${dotConfig.rankDirection};`);
  lines.push(`  node [shape=${dotConfig.nodeShape}, style="${dotConfig.nodeStyle}"];`);
  lines.push("");

  // Add nodes with styling based on calculate_on criteria
  for (const [serviceName, shaTarget] of Object.entries(config.targets)) {
    const nodeDefinition = generateNodeDefinition(serviceName, shaTarget.calculate_on, dotConfig);
    lines.push(nodeDefinition);
  }

  lines.push("");

  // Add edges for dependencies
  const edges = generateDependencyEdges(dependencyTree);
  lines.push(...edges);

  lines.push("}");
  writeFileSync(outPath, lines.join("\n"), "utf8");
}

/**
 * Generates a node definition with styling and criteria labels
 */
export function generateNodeDefinition(
  serviceName: string,
  calculateOn: DockerShaCalculateOnConfig | undefined,
  config: DotFileConfig = DEFAULT_DOT_CONFIG,
): string {
  const criteria = extractRebuildCriteria(calculateOn);
  const criteriaText = criteria.length > 0 ? `\\n(${criteria.join(", ")})` : "";
  const nodeColor = calculateOn?.always ? config.alwaysColor : config.defaultColor;

  return `  "${serviceName}" [label="${serviceName}${criteriaText}", fillcolor=${nodeColor}];`;
}

/**
 * Extracts rebuild criteria from calculate_on configuration for display
 */
export function extractRebuildCriteria(calculateOn: DockerShaCalculateOnConfig | undefined): string[] {
  if (!calculateOn) return [];

  const criteria: string[] = [];

  if (calculateOn.always) {
    criteria.push("always");
  }

  if (calculateOn.period) {
    criteria.push(formatPeriodCriteria(calculateOn.period));
  }

  if (calculateOn.files?.length) {
    criteria.push(`${calculateOn.files.length} files`);
  }

  if (calculateOn.jq) {
    criteria.push("jq");
  }

  return criteria;
}

/**
 * Formats period configuration for display in DOT file
 */
export function formatPeriodCriteria(period: string | { unit: string; number: number } | { unit: "none" }): string {
  if (typeof period === "string") {
    return period;
  }

  if (typeof period === "object" && "number" in period) {
    return `${period.number} ${period.unit}`;
  }

  if (typeof period === "object" && period.unit === "none") {
    return "none";
  }

  return "unknown";
}

/**
 * Generates dependency edges from the dependency tree
 */
export function generateDependencyEdges(dependencyTree: DependencyTree): string[] {
  const edges: string[] = [];

  for (const [serviceName, node] of dependencyTree.nodes) {
    for (const dependency of node.dependencies) {
      edges.push(`  "${dependency}" -> "${serviceName}";`);
    }
  }

  return edges;
}

/**
 * Converts DependencyTree to a simple dependency map for ASCII tree generation
 */
export function buildDependencyMap(dependencyTree: DependencyTree): Record<string, string[]> {
  const dependencyMap: Record<string, string[]> = {};

  for (const [serviceName, node] of dependencyTree.nodes) {
    dependencyMap[serviceName] = node.dependencies;
  }

  return dependencyMap;
}

/**
 * Validates that a DOT file configuration is valid
 */
export function validateDotConfig(config: DotFileConfig): boolean {
  const validRankDirections = ["LR", "TB", "RL", "BT"];

  if (config.rankDirection && !validRankDirections.includes(config.rankDirection)) {
    return false;
  }

  return true;
}

/**
 * Creates a DOT file configuration with defaults
 */
export function createDotConfig(overrides: Partial<DotFileConfig> = {}): DotFileConfig {
  return {
    ...DEFAULT_DOT_CONFIG,
    ...overrides,
  };
}
