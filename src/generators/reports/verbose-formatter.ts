/**
 * Verbose output formatter for displaying interpreted docker-sha.yml configuration
 */

import type { VerboseConfigInfo } from "@/core/reports/verbose-report-builder.js";

export class VerboseFormatter {
  constructor(private readonly _dockerShaFilePath: string) {}

  /**
   * Format verbose output for CLI display
   */
  formatOutput(configInfo: VerboseConfigInfo): string {
    const lines: string[] = [];

    lines.push("📋 Docker SHA Configuration Analysis");
    lines.push("═".repeat(50));
    lines.push("");

    // Configuration overview
    lines.push("📁 Configuration Overview:");
    lines.push(`   Docker SHA file: ${this._dockerShaFilePath}`);
    lines.push(`   Project context: ${configInfo.projectContext}`);

    if (configInfo.bakeFiles.length > 0) {
      lines.push("   Bake files:");
      for (const bakeFile of configInfo.bakeFiles) {
        const status = bakeFile.exists ? "✓" : "✗";
        lines.push(`     ${status} ${bakeFile.path}`);
      }
    }

    if (configInfo.outputFile) {
      const status = configInfo.outputFile.exists ? "✓" : "✗";
      lines.push(`   Output file: ${status} ${configInfo.outputFile.path}`);
    }

    lines.push("");

    // Target details
    if (configInfo.targets.length > 0) {
      lines.push(`🎯 Targets (${configInfo.targets.length}):`);
      lines.push("─".repeat(30));

      for (const target of configInfo.targets) {
        lines.push("");
        lines.push(`📦 ${target.name}`);
        lines.push(`   Context strategy: ${target.contextOf}`);
        lines.push(`   Resolved context: ${target.resolvedContext}`);

        if (target.bakeFile) {
          const status = target.bakeFile.exists ? "✓" : "✗";
          lines.push(`   Bake file: ${status} ${target.bakeFile.path}`);
          if (target.bakeTarget) {
            lines.push(`   Bake target: ${target.bakeTarget}`);
          }
        }

        if (target.dockerfile) {
          const status = target.dockerfile.exists ? "✓" : "✗";
          lines.push(`   Dockerfile: ${status} ${target.dockerfile.path}`);
        }

        if (target.files.length > 0) {
          lines.push("   Calculate files:");
          for (const file of target.files) {
            const status = file.exists ? "✓" : "✗";
            lines.push(`     ${status} ${file.path}`);
          }
        }

        if (target.jqFiles.length > 0) {
          lines.push("   JQ processing:");
          for (const jqFile of target.jqFiles) {
            const status = jqFile.file.exists ? "✓" : "✗";
            lines.push(`     ${status} ${jqFile.file.path} (selector: ${jqFile.selector})`);
          }
        }
      }
    }

    lines.push("");
    lines.push("Legend: ✓ = exists, ✗ = missing");

    return lines.join("\n");
  }
}
