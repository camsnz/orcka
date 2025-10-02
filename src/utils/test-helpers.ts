import { writeFileSync } from "node:fs";
import { stringify } from "yaml";

/**
 * Helper function to write YAML content to a file for testing
 * @param filePath - Path to write the file
 * @param content - Object to convert to YAML and write
 */
export function writeYamlFile(filePath: string, content: Record<string, unknown>): void {
  const yamlContent = stringify(content);
  writeFileSync(filePath, yamlContent);
}
