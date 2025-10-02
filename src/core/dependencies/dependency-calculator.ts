import type { DockerBakeTarget } from "../../types.js";

interface DependencyNode {
  serviceName: string;
  dependencies: string[];
  dependents: string[];
  level: number;
}

export interface DependencyTree {
  nodes: Map<string, DependencyNode>;
  roots: string[];
  leaves: string[];
  cycles: string[][];
}

export class CyclicDependencyError extends Error {
  constructor(public cycles: string[][]) {
    super(`Cyclic dependencies detected: ${cycles.map((cycle) => cycle.join(" -> ")).join(", ")}`);
    this.name = "CyclicDependencyError";
  }
}

/**
 * Extracts build-time image ancestry dependencies from Docker Bake targets.
 * These are dependencies where one image is built FROM another image.
 * Found in bake files via contexts field (values like "target:name").
 */
function extractImageAncestry(target: DockerBakeTarget): string[] {
  const dependencies: string[] = [];

  // Check for bake-style contexts field
  if (target.contexts) {
    for (const [_contextName, contextValue] of Object.entries(target.contexts)) {
      // Context values like "target:api" indicate this image depends on the "api" image
      if (typeof contextValue === "string" && contextValue.startsWith("target:")) {
        const targetName = contextValue.substring("target:".length);
        dependencies.push(targetName);
      }
    }
  }

  return dependencies;
}

/**
 * Extracts runtime service dependencies from Docker Compose targets.
 * These are dependencies for service startup ordering.
 * Found in compose files via depends_on field or x-bake.contexts.
 */
function extractRuntimeDependencies(target: DockerBakeTarget): string[] {
  const dependencies: string[] = [];

  // Check for compose-style depends_on field
  if (target.depends_on) {
    dependencies.push(...target.depends_on);
  }

  // health-checks: ignore TODO until 2025-10-04  // TODO: Add support for x-bake.contexts in compose files when needed

  return dependencies;
}

/**
 * Builds an image ancestry dependency tree from Docker Bake targets.
 * This shows build-time image dependencies (which images are built FROM other images).
 * Used for DOT file generation and build ordering.
 */
export function buildImageAncestryTree(targets: Record<string, DockerBakeTarget>): DependencyTree {
  const nodes = new Map<string, DependencyNode>();

  // Initialize all nodes from the bake targets
  for (const [targetName, target] of Object.entries(targets)) {
    // Extract image ancestry dependencies from contexts field
    const dependencies = extractImageAncestry(target);

    nodes.set(targetName, {
      serviceName: targetName,
      dependencies,
      dependents: [],
      level: 0,
    });
  }

  // Build reverse dependencies (dependents)
  for (const [serviceName, node] of nodes) {
    for (const dep of node.dependencies) {
      const depNode = nodes.get(dep);
      if (depNode) {
        depNode.dependents.push(serviceName);
      }
    }
  }

  // Detect cycles using DFS
  const cycles = detectCycles(nodes);
  if (cycles.length > 0) {
    throw new CyclicDependencyError(cycles);
  }

  // Calculate levels (topological sort)
  const levels = calculateLevels(nodes);
  for (const [serviceName, level] of levels) {
    const node = nodes.get(serviceName);
    if (node) {
      node.level = level;
    }
  }

  // Find roots (no dependencies) and leaves (no dependents)
  const roots: string[] = [];
  const leaves: string[] = [];

  for (const [serviceName, node] of nodes) {
    if (node.dependencies.length === 0) {
      roots.push(serviceName);
    }
    if (node.dependents.length === 0) {
      leaves.push(serviceName);
    }
  }

  return {
    nodes,
    roots,
    leaves,
    cycles,
  };
}

/**
 * Detects cycles in the dependency graph using DFS
 */
function detectCycles(nodes: Map<string, DependencyNode>): string[][] {
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const cycles: string[][] = [];

  function dfs(serviceName: string, path: string[]): void {
    if (recursionStack.has(serviceName)) {
      // Found a cycle
      const cycleStart = path.indexOf(serviceName);
      const cycle = path.slice(cycleStart).concat(serviceName);
      cycles.push(cycle);
      return;
    }

    if (visited.has(serviceName)) {
      return;
    }

    visited.add(serviceName);
    recursionStack.add(serviceName);

    const node = nodes.get(serviceName);
    if (node) {
      for (const dep of node.dependencies) {
        if (nodes.has(dep)) {
          dfs(dep, [...path, serviceName]);
        }
      }
    }

    recursionStack.delete(serviceName);
  }

  for (const serviceName of nodes.keys()) {
    if (!visited.has(serviceName)) {
      dfs(serviceName, []);
    }
  }

  return cycles;
}

/**
 * Calculates the level of each service in the dependency tree
 * Level 0 = no dependencies (roots)
 * Level N = max(dependency levels) + 1
 */
function calculateLevels(nodes: Map<string, DependencyNode>): Map<string, number> {
  const levels = new Map<string, number>();
  const visited = new Set<string>();

  function calculateLevel(serviceName: string): number {
    const existingLevel = levels.get(serviceName);
    if (existingLevel !== undefined) {
      return existingLevel;
    }

    if (visited.has(serviceName)) {
      // This shouldn't happen if cycles are already detected
      return 0;
    }

    visited.add(serviceName);

    const node = nodes.get(serviceName);
    if (!node || node.dependencies.length === 0) {
      levels.set(serviceName, 0);
      return 0;
    }

    let maxDepLevel = -1;
    for (const dep of node.dependencies) {
      if (nodes.has(dep)) {
        const depLevel = calculateLevel(dep);
        maxDepLevel = Math.max(maxDepLevel, depLevel);
      }
    }

    const level = maxDepLevel + 1;
    levels.set(serviceName, level);
    return level;
  }

  for (const serviceName of nodes.keys()) {
    calculateLevel(serviceName);
  }

  return levels;
}

/**
 * Gets services in dependency order (roots first, then by level)
 */
export function getServicesInDependencyOrder(tree: DependencyTree): string[] {
  const servicesByLevel = new Map<number, string[]>();

  for (const [serviceName, node] of tree.nodes) {
    const level = node.level;
    let services = servicesByLevel.get(level);
    if (!services) {
      services = [];
      servicesByLevel.set(level, services);
    }
    services.push(serviceName);
  }

  const result: string[] = [];
  const sortedLevels = Array.from(servicesByLevel.keys()).sort((a, b) => a - b);

  for (const level of sortedLevels) {
    const services = servicesByLevel.get(level);
    if (services) {
      result.push(...services.sort()); // Sort alphabetically within level
    }
  }

  return result;
}

/**
 * Builds a dependency tree based on runtime dependencies (depends_on field).
 * This is used for validating cyclic dependencies in Docker Compose/Bake files.
 */
function buildRuntimeDependencyTree(targets: Record<string, DockerBakeTarget>): DependencyTree {
  const nodes = new Map<string, DependencyNode>();

  // Initialize all nodes from the bake targets
  for (const [targetName, target] of Object.entries(targets)) {
    // Extract runtime dependencies from depends_on field
    const dependencies = extractRuntimeDependencies(target);

    nodes.set(targetName, {
      serviceName: targetName,
      dependencies,
      dependents: [],
      level: 0,
    });
  }

  // Build reverse dependencies (dependents)
  for (const [serviceName, node] of nodes) {
    for (const dependency of node.dependencies) {
      const dependencyNode = nodes.get(dependency);
      if (dependencyNode) {
        dependencyNode.dependents.push(serviceName);
      }
    }
  }

  // Detect cycles using DFS
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const cycles: string[][] = [];

  function detectCycles(serviceName: string, path: string[]): void {
    if (recursionStack.has(serviceName)) {
      // Found a cycle
      const cycleStart = path.indexOf(serviceName);
      const cycle = path.slice(cycleStart).concat([serviceName]);
      cycles.push(cycle);
      return;
    }

    if (visited.has(serviceName)) {
      return;
    }

    visited.add(serviceName);
    recursionStack.add(serviceName);

    const node = nodes.get(serviceName);
    if (node) {
      for (const dependency of node.dependencies) {
        detectCycles(dependency, [...path, serviceName]);
      }
    }

    recursionStack.delete(serviceName);
  }

  // Check all nodes for cycles
  for (const serviceName of nodes.keys()) {
    if (!visited.has(serviceName)) {
      detectCycles(serviceName, []);
    }
  }

  if (cycles.length > 0) {
    throw new CyclicDependencyError(cycles);
  }

  // Calculate levels and find roots/leaves
  const calculateLevels = () => {
    const roots: string[] = [];
    const leaves: string[] = [];

    for (const [serviceName, node] of nodes) {
      if (node.dependencies.length === 0) {
        roots.push(serviceName);
      }
      if (node.dependents.length === 0) {
        leaves.push(serviceName);
      }
    }

    return { roots, leaves };
  };

  const { roots, leaves } = calculateLevels();

  return {
    nodes,
    roots,
    leaves,
    cycles,
  };
}

/**
 * Legacy function for backward compatibility.
 * @deprecated Use buildImageAncestryTree() for DOT files or buildRuntimeDependencyTree() for runtime dependencies
 */
export function buildDependencyTree(targets: Record<string, DockerBakeTarget>): DependencyTree {
  // For backward compatibility, use the runtime dependency tree for validation
  return buildRuntimeDependencyTree(targets);
}

export function collectDependencyClosure(tree: DependencyTree, seeds: Iterable<string>): Set<string> {
  const result = new Set<string>();
  const stack: string[] = [];

  for (const seed of seeds) {
    stack.push(seed);
  }

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || result.has(current)) {
      continue;
    }

    result.add(current);
    const node = tree.nodes.get(current);
    if (!node) {
      continue;
    }

    for (const dependency of node.dependencies) {
      if (!result.has(dependency)) {
        stack.push(dependency);
      }
    }
  }

  return result;
}
