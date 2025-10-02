/**
 * Utilities for displaying files being read by orcka
 */

import { Clout } from "@/cli/utilities/clout";

export interface FilesSectionData {
  orcka: string[];
  bake: string[];
  compose: string[];
}

type FilesSectionKey = keyof FilesSectionData;

interface FilesDisplayOptions {
  header?: string;
  emoji?: string;
  missingEntries?: Partial<Record<FilesSectionKey, Set<string>>>;
}

const SECTION_ORDER: Array<{ key: FilesSectionKey; label: string }> = [
  { key: "orcka", label: "orcka" },
  { key: "bake", label: "bake" },
  { key: "compose", label: "compose" },
];

function formatMissingIndicator(
  key: FilesSectionKey,
  value: string,
  missingEntries?: Partial<Record<FilesSectionKey, Set<string>>>,
): string {
  if (!missingEntries) {
    return "";
  }

  const missingSet = missingEntries[key];
  if (missingSet?.has(value)) {
    return " ❌";
  }

  return "";
}

/**
 * Display the files section using the standard health-check inspired layout
 */
export function displayFilesSection(files: FilesSectionData, options: FilesDisplayOptions = {}): void {
  const header = options.header ?? "Reading files";
  const emoji = options.emoji ?? "✅";

  console.log("");
  console.log(`${emoji} ${header}:`);

  for (const { key, label } of SECTION_ORDER) {
    const entries = files[key];
    if (entries.length === 0) {
      continue;
    }

    if (entries.length === 1) {
      const entry = entries[0];
      const missingIndicator = formatMissingIndicator(key, entry, options.missingEntries);
      console.log(Clout.bullet(`${label}: ${entry}${missingIndicator}`));
    } else {
      console.log(Clout.bullet(`${label}:`));
      for (const entry of entries) {
        const missingIndicator = formatMissingIndicator(key, entry, options.missingEntries);
        console.log(Clout.dash(`${entry}${missingIndicator}`));
      }
    }
  }
}

/**
 * Collect files being processed during calculation
 */
export function collectCalculationFiles(
  mainConfigFile: string,
  bakeFiles: string[],
  composeFiles: string[] = [],
): FilesSectionData {
  return {
    orcka: [mainConfigFile],
    bake: bakeFiles,
    compose: composeFiles,
  };
}
