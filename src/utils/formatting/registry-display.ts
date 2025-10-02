/**
 * Registry Display Utilities
 * 
 * Formats and displays Docker registry information in a clean, readable format
 */

import { Clout } from "@/cli/utilities/clout";
import type { RegistryAnalysisResult, RegistryInfo } from "@/docker/registry/registry-analyzer";
import { formatRegistryStatus } from "@/docker/registry/registry-analyzer";

/**
 * Display registry analysis results
 */
export function displayRegistrySection(analysis: RegistryAnalysisResult): void {
  if (analysis.registries.length === 0) {
    return;
  }

  console.log("");
  console.log("🌐 Docker Registries:");
  console.log("");

  // Summary line
  console.log(`  Total: ${analysis.totalImages} images across ${analysis.registries.length} ${analysis.registries.length === 1 ? "registry" : "registries"}`);
  console.log(`  Local: ${analysis.totalLocal} images (${Math.round((analysis.totalLocal / analysis.totalImages) * 100)}% available locally)`);
  console.log("");

  // Registry details table
  const headers = ["Registry", "Status", "Images", "Local"];
  const rows = analysis.registries.map((reg) => [
    reg.name,
    formatRegistryStatus(reg),
    reg.imageCount.toString(),
    `${reg.localCount}/${reg.imageCount}`,
  ]);

  const table = Clout.table(headers, rows, {
    columnWidths: [30, 20, 8, 12],
    align: ["left", "left", "right", "right"],
    border: false,
    truncate: true,
  });

  console.log(table);

  // Show warnings for inaccessible registries
  const inaccessibleRegistries = analysis.registries.filter((r) => !r.accessible);
  if (inaccessibleRegistries.length > 0) {
    console.log("");
    console.log("  ⚠️  Registry Access Issues:");
    for (const reg of inaccessibleRegistries) {
      const reason = reg.error || "unknown";
      console.log(`    • ${reg.name}: ${reason}`);
      if (reason === "unauthorized" && !reg.authenticated) {
        console.log(`      → Run: docker login ${reg.name}`);
      }
    }
  }

  // Show errors if any
  if (analysis.errors.length > 0) {
    console.log("");
    console.log("  ⚠️  Registry Analysis Errors:");
    for (const error of analysis.errors) {
      console.log(`    • ${error}`);
    }
  }
}

/**
 * Create a compact one-line registry summary
 */
export function formatRegistrySummary(analysis: RegistryAnalysisResult): string {
  const accessibleCount = analysis.registries.filter((r) => r.accessible).length;
  const authCount = analysis.registries.filter((r) => r.authenticated).length;
  
  if (analysis.registries.length === 0) {
    return "No registries";
  }

  const parts: string[] = [];
  parts.push(`${analysis.registries.length} ${analysis.registries.length === 1 ? "registry" : "registries"}`);
  
  if (accessibleCount === analysis.registries.length) {
    parts.push("✅ all accessible");
  } else {
    parts.push(`⚠️ ${accessibleCount}/${analysis.registries.length} accessible`);
  }

  if (authCount > 0) {
    parts.push(`🔐 ${authCount} authenticated`);
  }

  return parts.join(", ");
}

/**
 * Display compact registry list (for verbose mode)
 */
export function displayCompactRegistryList(registries: RegistryInfo[]): void {
  if (registries.length === 0) {
    return;
  }

  for (const reg of registries) {
    const status = formatRegistryStatus(reg);
    console.log(`  • ${reg.name}: ${status} (${reg.localCount}/${reg.imageCount} local)`);
  }
}

