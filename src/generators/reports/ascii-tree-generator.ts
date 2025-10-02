/**
 * ASCII Tree Generator for orcka
 * Generates terminal-friendly dependency tree visualization
 */

import type { DockerBakeTarget } from "../../types.js";

interface TreeNode {
  name: string;
  dependencies: string[];
  rebuildCriteria: string;
  isPattern: boolean;
  visited?: boolean;
}

interface TreeOptions {
  showRebuildCriteria: boolean;
  detectPatterns: boolean;
  maxDepth: number;
}

/**
 * Generates ASCII tree visualization of service dependencies
 */
export class AsciiTreeGenerator {
  private options: TreeOptions;

  constructor(options: Partial<TreeOptions> = {}) {
    this.options = {
      showRebuildCriteria: true,
      detectPatterns: true,
      maxDepth: 10,
      ...options,
    };
  }

  /**
   * Generate ASCII tree from bake targets and dependency information
   */
  generateTree(
    bakeTargets: Record<string, DockerBakeTarget>,
    dependencyMap: Record<string, string[]>,
    configFile: string,
    bakeFiles: string[],
  ): string {
    const nodes = this.buildNodes(bakeTargets, dependencyMap);
    const { rootNodes, patternNodes } = this.analyzeNodes(nodes);

    const output: string[] = [];

    // Header
    output.push("🌳 Docker Build Target Hierarchy");
    output.push(`📁 Config file: ${configFile}`);
    output.push(`📁 Bake files: ${bakeFiles.join(", ")}`);
    output.push("");

    // Pattern targets (reusable components)
    if (patternNodes.length > 0 && this.options.detectPatterns) {
      output.push("🔄 Pattern Targets (Reusable Components):");
      output.push("");

      for (let i = 0; i < patternNodes.length; i++) {
        const isLast = i === patternNodes.length - 1;
        const pattern = patternNodes[i];

        output.push(`${isLast ? "└── " : "├── "}${pattern.name}${this.formatRebuildCriteria(pattern)}`);
        this.renderSubtree(pattern, nodes, output, isLast ? "    " : "│   ", new Set(), 0);
      }
      output.push("");
    }

    // Root targets (main entry points)
    if (rootNodes.length > 0) {
      output.push("🎯 Root Targets:");
      output.push("");

      for (let i = 0; i < rootNodes.length; i++) {
        const isLast = i === rootNodes.length - 1;
        const root = rootNodes[i];

        output.push(`${isLast ? "└── " : "├── "}${root.name}${this.formatRebuildCriteria(root)}`);
        this.renderSubtree(root, nodes, output, isLast ? "    " : "│   ", new Set([root.name]), 0);
      }
    } else {
      output.push("⚠️  No clear root targets found");
    }

    // Summary
    output.push("");
    output.push("📊 Summary:");
    output.push(`Total targets: ${Object.keys(nodes).length}`);
    output.push(`Root targets: ${rootNodes.length}`);
    output.push(`Pattern targets: ${patternNodes.length}`);
    output.push(`Targets with dependencies: ${Object.values(nodes).filter((n) => n.dependencies.length > 0).length}`);

    return output.join("\n");
  }

  /**
   * Build tree nodes from bake targets and dependencies
   */
  private buildNodes(
    bakeTargets: Record<string, DockerBakeTarget>,
    dependencyMap: Record<string, string[]>,
  ): Record<string, TreeNode> {
    const nodes: Record<string, TreeNode> = {};

    for (const [name, target] of Object.entries(bakeTargets)) {
      const dependencies = dependencyMap[name] || [];
      const rebuildCriteria = this.extractRebuildCriteria(target);

      nodes[name] = {
        name,
        dependencies,
        rebuildCriteria,
        isPattern: false, // Will be determined in analyzeNodes
      };
    }

    return nodes;
  }

  /**
   * Analyze nodes to identify root targets and patterns
   */
  private analyzeNodes(nodes: Record<string, TreeNode>): {
    rootNodes: TreeNode[];
    patternNodes: TreeNode[];
  } {
    const allTargets = Object.keys(nodes);
    const dependedUpon = new Set<string>();

    // Find all targets that are dependencies of others
    for (const node of Object.values(nodes)) {
      for (const dep of node.dependencies) {
        dependedUpon.add(dep);
      }
    }

    // Root targets are those not depended upon by others
    const rootTargets = allTargets.filter((name) => !dependedUpon.has(name));

    // Pattern targets are those that:
    // 1. Are depended upon by others
    // 2. Have their own dependencies
    const patternTargets = allTargets.filter((name) => dependedUpon.has(name) && nodes[name].dependencies.length > 0);

    // Mark pattern nodes
    for (const patternName of patternTargets) {
      nodes[patternName].isPattern = true;
    }

    return {
      rootNodes: rootTargets.map((name) => nodes[name]).sort((a, b) => a.name.localeCompare(b.name)),
      patternNodes: patternTargets.map((name) => nodes[name]).sort((a, b) => a.name.localeCompare(b.name)),
    };
  }

  /**
   * Recursively render subtree
   */
  private renderSubtree(
    node: TreeNode,
    allNodes: Record<string, TreeNode>,
    output: string[],
    prefix: string,
    visited: Set<string>,
    depth: number,
  ): void {
    if (depth >= this.options.maxDepth) {
      output.push(`${prefix}└── ... (max depth reached)`);
      return;
    }

    const sortedDeps = [...node.dependencies].sort();

    for (let i = 0; i < sortedDeps.length; i++) {
      const depName = sortedDeps[i];
      const isLast = i === sortedDeps.length - 1;
      const depNode = allNodes[depName];

      if (!depNode) {
        // Dependency not found in bake targets
        output.push(`${prefix}${isLast ? "└── " : "├── "}${depName} (external)`);
        continue;
      }

      if (visited.has(depName)) {
        // Cycle detected
        output.push(`${prefix}${isLast ? "└── " : "├── "}${depName} (↻)`);
        continue;
      }

      if (depNode.isPattern && this.options.detectPatterns) {
        // Reference to pattern - don't expand, just show reference
        output.push(
          `${prefix}${isLast ? "└── " : "├── "}${depName}${this.formatRebuildCriteria(depNode)} → see pattern above`,
        );
        continue;
      }

      // Normal dependency
      output.push(`${prefix}${isLast ? "└── " : "├── "}${depName}${this.formatRebuildCriteria(depNode)}`);

      if (depNode.dependencies.length > 0) {
        const newVisited = new Set([...visited, depName]);
        const newPrefix = prefix + (isLast ? "    " : "│   ");
        this.renderSubtree(depNode, allNodes, output, newPrefix, newVisited, depth + 1);
      }
    }
  }

  /**
   * Extract rebuild criteria from bake target
   */
  private extractRebuildCriteria(target: DockerBakeTarget): string {
    // This would be enhanced to extract actual rebuild criteria
    // For now, return a placeholder
    if (target.contexts && Object.keys(target.contexts).length > 0) {
      return "context-dependent";
    }
    return "default";
  }

  /**
   * Format rebuild criteria for display
   */
  private formatRebuildCriteria(node: TreeNode): string {
    if (!this.options.showRebuildCriteria) {
      return "";
    }
    return ` [${node.rebuildCriteria}]`;
  }
}
