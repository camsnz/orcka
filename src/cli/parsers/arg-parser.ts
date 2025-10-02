/**
 * Reusable argument parsing system for orcka CLI commands
 * Provides a declarative approach to define command-line arguments
 */

interface ArgDefinition {
  /** Argument names (e.g., ['--file', '-f']) */
  names: string[];
  /** Description for help text */
  description: string;
  /** Whether this argument is required */
  required?: boolean;
  /** Whether this argument accepts a value */
  hasValue?: boolean;
  /** Whether this argument can accept multiple values */
  multiValue?: boolean;
  /** Default value if not provided */
  defaultValue?: string | string[] | boolean;
  /** Custom validator function */
  validator?: (value: string | string[]) => string | null; // Returns error message or null if valid
}

interface ParsedArgs {
  [key: string]: string | string[] | boolean | undefined;
}

export interface CommandConfig {
  /** Command name for error messages */
  name: string;
  /** Argument definitions */
  args: Record<string, ArgDefinition>;
  /** Usage examples */
  examples?: string[];
}

/**
 * Parse command line arguments based on configuration
 */
export function parseArguments(argv: string[], config: CommandConfig): ParsedArgs {
  const result: ParsedArgs = {};
  const argMap = new Map<string, string>();

  // Build argument name mapping
  for (const [key, def] of Object.entries(config.args)) {
    for (const name of def.names) {
      argMap.set(name, key);
    }
  }

  // Parse arguments
  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];

    if (arg === "--help" || arg === "-h") {
      showCommandHelp(config);
      process.exit(0);
    }

    if (!arg.startsWith("--") && !arg.startsWith("-")) {
      throw new Error(`Unexpected argument: ${arg}`);
    }

    const key = argMap.get(arg);
    if (!key) {
      throw new Error(`Unknown argument: ${arg}`);
    }

    const def = config.args[key];

    if (!def.hasValue) {
      // Boolean flag
      result[key] = true;
      i++;
    } else if (def.multiValue) {
      // Multi-value argument
      const values: string[] = [];
      i++;

      while (i < argv.length && !argv[i].startsWith("-")) {
        values.push(argv[i]);
        i++;
      }

      if (values.length === 0 && def.required) {
        throw new Error(`${arg} requires at least one value`);
      }

      result[key] = values.length === 1 ? values[0] : values;
    } else {
      // Single value argument
      i++;
      if (i >= argv.length || argv[i].startsWith("-")) {
        if (def.defaultValue !== undefined) {
          result[key] = def.defaultValue;
        } else {
          throw new Error(`${arg} requires a value`);
        }
      } else {
        result[key] = argv[i];
        i++;
      }
    }
  }

  // Validate required arguments and run validators
  for (const [key, def] of Object.entries(config.args)) {
    if (result[key] === undefined && def.required) {
      throw new Error(`Required argument missing: ${def.names[0]}`);
    }

    // Run custom validator
    if (result[key] !== undefined && def.validator) {
      const error = def.validator(result[key] as string | string[]);
      if (error) {
        throw new Error(`${def.names[0]}: ${error}`);
      }
    }
  }

  return result;
}

/**
 * Generate help text for a command
 */
function showCommandHelp(config: CommandConfig): void {
  console.log(`\nUsage: orcka ${config.name} [options]\n`);

  console.log("Options:");
  for (const [_, def] of Object.entries(config.args)) {
    const names = def.names.join(", ");
    const required = def.required ? " (required)" : "";
    const defaultVal = def.defaultValue !== undefined ? ` (default: ${def.defaultValue})` : "";
    console.log(`  ${names.padEnd(30)} ${def.description}${required}${defaultVal}`);
  }

  if (config.examples && config.examples.length > 0) {
    console.log("\nExamples:");
    for (const example of config.examples) {
      console.log(`  ${example}`);
    }
  }

  console.log();
}

/**
 * Common argument definitions that can be reused across commands
 */
export const CommonArgs = {
  file: {
    names: ["--file", "-f"],
    description: "Path to input file",
    hasValue: true,
  } as ArgDefinition,

  help: {
    names: ["--help", "-h"],
    description: "Show help message",
    hasValue: false,
  } as ArgDefinition,

  dryRun: {
    names: ["--dry-run"],
    description: "Show commands without executing",
    hasValue: false,
    defaultValue: false,
  } as ArgDefinition,

  output: {
    names: ["--output", "-o"],
    description: "Output file path",
    hasValue: true,
  } as ArgDefinition,
};

/**
 * Validators for common argument types
 */
export const Validators = {
  existingFile: (value: string | string[]): string | null => {
    if (Array.isArray(value)) {
      return "File path cannot be an array";
    }
    // Note: We could add fs.existsSync check here, but it might be too strict for some use cases
    return null;
  },

  periodUnit: (value: string | string[]): string | null => {
    if (Array.isArray(value)) {
      return "Period unit must be a single value";
    }
    const valid = ["hours", "days", "weeks", "months", "quarters", "years", "none"];
    if (!valid.includes(value)) {
      return `Must be one of: ${valid.join(", ")}`;
    }
    return null;
  },
};
