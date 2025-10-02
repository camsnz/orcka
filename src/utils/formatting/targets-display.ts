/**
 * Utilities for displaying targets table with calculation criteria and tag_ver
 */

import { Clout } from "@/cli/utilities/clout";
import type { DockerShaCalculateOnConfig } from "../../types.js";

export interface TargetDisplayData {
  name: string;
  calculationCriteria: string;
  tagVer: string;
  composeTag?: string; // NEW: Compose tag for dual tagging
  status?: "success" | "not_found" | "requires_dependency";
  requiredTarget?: string;
}

/**
 * Format calculation criteria for display
 */
export function formatCalculationCriteria(calculateOn: DockerShaCalculateOnConfig | undefined): string {
  const flags: string[] = [];

  if (!calculateOn) {
    return "A";
  }

  const addFlag = (flag: string) => {
    if (!flags.includes(flag)) {
      flags.push(flag);
    }
  };

  if (calculateOn.files && calculateOn.files.length > 0) {
    addFlag("F");
  }

  if (calculateOn.jq) {
    addFlag("J");
  }

  if (calculateOn.period) {
    if (typeof calculateOn.period === "string") {
      addFlag(calculateOn.period.charAt(0).toUpperCase());
    } else if (calculateOn.period.unit === "none") {
      addFlag("N");
    } else if (calculateOn.period.unit) {
      addFlag(calculateOn.period.unit.charAt(0).toUpperCase());
    } else {
      addFlag("P");
    }
  }

  if (calculateOn.always) {
    addFlag("A");
  }

  if (calculateOn.date) {
    addFlag("D");
  }

  return flags.length > 0 ? flags.join("") : "A";
}

/**
 * Display the targets section showing calculation criteria and tag versions
 * Fixed 80-character width table with proper error handling
 * Supports dual tagging display (orcka + compose tags)
 */
export function displayTargetsSection(targets: TargetDisplayData[]): void {
  if (targets.length === 0) return;

  // Check if any targets have compose tags
  const hasComposeTags = targets.some((t) => t.composeTag && t.status === "success");

  // Prepare table data
  const headers = hasComposeTags ? ["Target", "Calc", "Orcka Tag", "Compose Tag"] : ["Target", "Calc", "Tag"];
  
  const rows = targets.map((target) => {
    let tagVer = target.tagVer;

    // Handle different statuses
    if (target.status === "not_found") {
      tagVer = "❌ not found";
    } else if (target.status === "requires_dependency") {
      tagVer = `requires ${target.requiredTarget || "dependency"}`;
    }

    if (hasComposeTags) {
      const composeTag = target.composeTag || "-";
      return [target.name, target.calculationCriteria, tagVer, composeTag];
    } else {
      return [target.name, target.calculationCriteria, tagVer];
    }
  });

  // Use Clout.table with custom column widths and truncation
  const table = hasComposeTags
    ? Clout.table(headers, rows, {
        columnWidths: [16, 6, 24, 24],
        align: ["left", "left", "left", "left"],
        border: false,
        truncate: true,
      })
    : Clout.table(headers, rows, {
        columnWidths: [20, 8, 42],
        align: ["left", "left", "left"],
        border: false,
        truncate: true,
      });

  console.log(table);
}
