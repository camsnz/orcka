import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { parse as yamlParse } from "yaml";
import {
  buildDependencyTree,
  buildImageAncestryTree,
  CyclicDependencyError,
  collectDependencyClosure,
  getServicesInDependencyOrder,
} from "@/core/dependencies/dependency-calculator.js";
import { validateDockerShaFile } from "@/core/validation/docker-sha-validator.js";
import { type ParsedBakeConfig, validateTargetsAndVariables } from "@/core/validation/target-validator.js";
import { buildDependencyMap, generateDotFile } from "@/generators/dot/dot-file-generator.js";
import { generateCalculatedHcl as generateHcl } from "@/generators/hcl/hcl-generator.js";
import { AsciiTreeGenerator } from "@/generators/reports/ascii-tree-generator.js";
import type { DockerBakeTarget, DockerShaConfig, DockerShaProjectConfig } from "@/types.js";
import { HclParser } from "@/utils/file/hcl-parser.js";
import { collectCalculationFiles, displayFilesSection } from "@/utils/formatting/files-display.js";
import {
  displayTargetsSection,
  formatCalculationCriteria,
  type TargetDisplayData,
} from "@/utils/formatting/targets-display.js";
import { Logger } from "@/utils/logging/logger.js";
import { ensureOrckaDirectory, resolveTagsOutputPath } from "@/utils/orcka-output-paths.js";
import { buildHashInput } from "./hash-builder.js";
import type { CalculateDockerShaOptions, CalculateDockerShaResult } from "./types.js";

/**
 * Main calculate function that processes docker-sha.yml and generates the HCL output file.
 */
export async function calculateDockerSha(options: CalculateDockerShaOptions): Promise<CalculateDockerShaResult> {
  const logger = new Logger({
    verbose: options.verbose ?? false,
    quiet: options.quiet ?? false,
  });
  const projectDir = dirname(options.inputFile);
  let config: DockerShaConfig | null = null;
  let outputFile = "";
  let contextDir = projectDir;
  let composeFiles: string[] = [];
  const allBakeTargets: Record<string, DockerBakeTarget> = {};
  let projectConfig: DockerShaProjectConfig | null = null;
  const shouldWriteOutput = options.writeOutput ?? true;
  const serviceFilterSet = (() => {
    const input = options.serviceFilter;
    if (!input) {
      return undefined;
    }
    if (input instanceof Set) {
      return new Set(input);
    }
    if (Array.isArray(input)) {
      return new Set(input);
    }
    return undefined;
  })();

  logger.verbose(`Starting docker-sha calculation for: ${options.inputFile}`);

  try {
    // 1. Parse the main docker-sha.yml configuration file first (for display)
    logger.verbose("Parsing docker-sha.yml configuration...");
    const shaFileContent = readFileSync(options.inputFile, "utf-8");
    config = yamlParse(shaFileContent);
    if (!config) {
      throw new Error("Unable to parse docker-sha configuration");
    }

    const parsedProject = config.project;
    projectConfig = parsedProject ?? {
      name: "orcka",
      bake: [],
    };

    // Calculate context directory - resolve relative to docker-sha.yml location
    contextDir = join(projectDir, projectConfig.context || ".");
    composeFiles = Array.isArray(projectConfig.compose) ? projectConfig.compose : [];

    const outputDir = ensureOrckaDirectory(contextDir);
    outputFile = resolveTagsOutputPath(contextDir, projectConfig);
    logger.verbose(`Context directory: ${contextDir}`);
    logger.verbose(`Output directory: ${outputDir}`);
    logger.verbose(`Output file: ${outputFile}`);

    // Display files being read (unless quiet mode) - show even if files are missing
    if (!options.quiet && projectConfig.bake && Array.isArray(projectConfig.bake)) {
      const filesData = collectCalculationFiles(options.inputFile, projectConfig.bake, composeFiles);

      const missingEntries: Partial<Record<"orcka" | "bake" | "compose", Set<string>>> = {};
      const ensureMissingSet = (key: "orcka" | "bake" | "compose") => {
        if (!missingEntries[key]) {
          missingEntries[key] = new Set<string>();
        }
        return missingEntries[key] ?? new Set<string>();
      };

      let hasMissingFiles = false;

      for (const bakeFile of filesData.bake) {
        const bakeFilePath = join(contextDir, bakeFile);
        if (!existsSync(bakeFilePath)) {
          hasMissingFiles = true;
          ensureMissingSet("bake").add(bakeFile);
        }
      }

      for (const composeFile of filesData.compose) {
        const composeFilePath = join(contextDir, composeFile);
        if (!existsSync(composeFilePath)) {
          hasMissingFiles = true;
          ensureMissingSet("compose").add(composeFile);
        }
      }

      displayFilesSection(filesData, {
        emoji: hasMissingFiles ? "🔴" : "✅",
        missingEntries: Object.keys(missingEntries).length > 0 ? missingEntries : undefined,
      });
    }

    // 2. Validate the docker-sha.yml file
    logger.verbose("Validating docker-sha.yml configuration...");
    const validationResult = await validateDockerShaFile(options.inputFile);
    if (!validationResult.valid) {
      // Show targets info before showing errors
      if (!options.quiet) {
        const configTargets = Object.keys(config.targets || {});
        if (configTargets.length > 0) {
          console.log("");
          console.log("🔴 Calculating targets:");
          for (const targetName of configTargets) {
            console.log(`  • ${targetName}`);
          }
        }

        console.log("");
        console.log("❌ Errors:");
        for (const error of validationResult.errors) {
          console.log(`❌ ${error.message}`);
        }
      }

      return {
        success: false,
        outputFile,
        projectContext: contextDir,
        project: projectConfig,
        servicesCalculated: 0,
        generatedServices: [],
        resolvedTags: {},
        composeFiles,
        bakeTargets: allBakeTargets,
        errors: validationResult.errors.map((e) => e.message),
      };
    }
    logger.verbose("✓ Configuration validation passed");

    // 3. Read and parse all bake files specified in the project config
    const bakeFiles = projectConfig.bake || [];
    logger.verbose(`Processing ${bakeFiles.length} bake file(s)...`);
    const bakeFileContents = new Map<string, string>();
    const parsedBakeConfigs = new Map<string, ParsedBakeConfig>();
    for (const bakeFile of bakeFiles) {
      const bakeFilePath = join(contextDir, bakeFile);
      logger.verbose(`Reading bake file: ${bakeFile}`);
      try {
        const bakeFileContent = readFileSync(bakeFilePath, "utf-8");
        bakeFileContents.set(bakeFilePath, bakeFileContent);

        // Use centralized HCL parser
        const parseResult = await HclParser.parseHclFile(bakeFilePath, bakeFile, {
          useFallback: false,
          silent: false,
        });

        if (!parseResult.success) {
          logger.error(`HCL parsing failed for ${bakeFile}: ${parseResult.error}`);
        }

        const bakeConfig =
          parseResult.success && parseResult.data
            ? parseResult.data
            : { target: {} as Record<string, DockerBakeTarget> };

        // Store parsed bake config for target validation
        parsedBakeConfigs.set(bakeFile, bakeConfig);

        if (bakeConfig?.target) {
          const targetCount = Object.keys(bakeConfig.target).length;
          logger.verbose(`Found ${targetCount} target(s) in ${bakeFile}`);

          // Only add entries that are actually targets (have dockerfile or other target properties)
          for (const [targetName, targetConfig] of Object.entries(bakeConfig.target)) {
            // Filter out invalid target names that contain parentheses or other invalid characters
            // This handles HCL parser bugs where variable references get incorrectly parsed as targets
            if (targetName.includes(")") || targetName.includes("(")) {
              logger.verbose(`Skipping invalid target name with parentheses: ${targetName}`);
              continue;
            }

            if (targetConfig && typeof targetConfig === "object") {
              allBakeTargets[targetName] = targetConfig;
            } else {
              logger.verbose(`Skipping invalid target: ${targetName}`);
            }
          }
        }
      } catch (e) {
        // Don't throw immediately - we'll show the error in the display and let validation handle it
        logger.verbose(`Failed to read bake file ${bakeFile}: ${e}`);
      }
    }

    // 4. Validate targets and TAG_VER variables
    logger.verbose("Validating targets and TAG_VER variables...");
    const validationErrors = validateTargetsAndVariables(config, allBakeTargets, parsedBakeConfigs);

    // Build comprehensive targets table data (unless quiet mode) - show even if validation fails
    const targetsDisplayData: TargetDisplayData[] = [];
    if (!options.quiet) {
      const displayTargets = new Set<string>();
      const configTargets = Object.keys(config.targets || {});
      for (const targetName of configTargets) {
        displayTargets.add(targetName);
      }

      if (serviceFilterSet && serviceFilterSet.size > 0) {
        for (const targetName of serviceFilterSet) {
          displayTargets.add(targetName);
        }
      } else {
        for (const targetName of Object.keys(allBakeTargets)) {
          displayTargets.add(targetName);
        }
      }

      const sortedDisplayTargets = Array.from(displayTargets).sort();

      // Create display data for all relevant targets
      for (const targetName of sortedDisplayTargets) {
        const isInBake = targetName in allBakeTargets;
        const targetConfig = config.targets?.[targetName];

        targetsDisplayData.push({
          name: targetName,
          calculationCriteria: formatCalculationCriteria(targetConfig?.calculate_on),
          tagVer: "", // Filled later if calculation succeeds
          status: isInBake ? "success" : "not_found",
        });
      }
    }

    if (validationErrors.length > 0) {
      // Display targets table with errors
      if (!options.quiet && targetsDisplayData.length > 0) {
        const hasErrors = targetsDisplayData.some((t) => t.status === "not_found");
        const headerEmoji = hasErrors ? "🔴" : "✅";
        console.log("");
        console.log(`${headerEmoji} Calculating targets:`);
        displayTargetsSection(targetsDisplayData);

        console.log("");
        console.log("❌ Errors:");
        for (const error of validationErrors) {
          console.log(`❌ ${error}`);
        }
      }

      return {
        success: false,
        outputFile,
        projectContext: contextDir,
        project: projectConfig,
        servicesCalculated: 0,
        generatedServices: [],
        resolvedTags: {},
        composeFiles,
        bakeTargets: allBakeTargets,
        errors: validationErrors,
      };
    }

    // 5. Build dependency tree and detect cycles
    logger.verbose("Building dependency tree...");
    const dependencyTree = buildDependencyTree(allBakeTargets);
    let servicesInOrder = getServicesInDependencyOrder(dependencyTree);
    logger.verbose(`Services in dependency order: ${servicesInOrder.join(", ")}`);

    let effectiveServiceFilter: Set<string> | undefined;
    if (serviceFilterSet && serviceFilterSet.size > 0) {
      effectiveServiceFilter = collectDependencyClosure(dependencyTree, serviceFilterSet);

      const imageAncestryTree = buildImageAncestryTree(allBakeTargets);
      const buildDependencies = collectDependencyClosure(imageAncestryTree, serviceFilterSet);
      for (const service of buildDependencies) {
        effectiveServiceFilter.add(service);
      }

      servicesInOrder = servicesInOrder.filter((service) => effectiveServiceFilter?.has(service) ?? false);

      logger.verbose(`Filtered services for calculation: ${servicesInOrder.join(", ")}`);
    }

    // 6. Generate the HCL output content
    logger.verbose("Generating calculated HCL content...");
    // Resolve compose file paths relative to context directory
    const absoluteComposeFiles = composeFiles.map((file) => join(contextDir, file));
    const { hclOutput, generatedServices, resolvedTags } = await generateHcl(
      config,
      allBakeTargets,
      servicesInOrder,
      contextDir,
      logger,
      buildHashInput,
      undefined, // Use default HCL config
      absoluteComposeFiles, // Pass compose files for tag resolution
    );

    // Update targets display data with successful calculations and display table
    if (!options.quiet) {
      // Update the display data with calculated tag versions and compose tags
      for (const service of generatedServices) {
        const targetData = targetsDisplayData.find((t) => t.name === service.name);
        if (targetData) {
          targetData.tagVer = service.imageTag;
          targetData.composeTag = service.composeTag; // Add compose tag for dual display
          targetData.status = "success";
        }
      }

      // Display targets table
      const hasErrors = targetsDisplayData.some((t) => t.status === "not_found");
      const headerEmoji = hasErrors ? "🔴" : "✅";
      console.log("");
      console.log(`${headerEmoji} Calculating targets:`);
      displayTargetsSection(targetsDisplayData);
    }

    // 7. Write the HCL output file with header
    logger.verbose(`Writing output to: ${outputFile}`);
    const headerContent = `## ############################################################################
## This file is generated by orcka, and can be empty by default.
## orcka sets TAG values calculated according to criteria specified in
## docker-sha.yml and service ancestry (target.depends_on) in docker-bake.hcl
## ############################################################################

`;
    const finalOutput = headerContent + hclOutput;
    if (shouldWriteOutput) {
      writeFileSync(outputFile, finalOutput, "utf-8");
    }

    // Display success message in standard header format with variables table
    if (!options.quiet) {
      const outputLabel = relative(projectDir, outputFile);
      const headerLabel = shouldWriteOutput ? "Wrote files" : "Would write files";

      console.log("");
      console.log(`✅ ${headerLabel}:`);
      console.log(`  • ${outputLabel}`);

      if (generatedServices.length > 0) {
        console.log("  • TAG_VER values:");
        const varNameWidth = Math.max(...generatedServices.map((service) => service.varName.length));
        for (const service of generatedServices) {
          const paddedVarName = service.varName.padEnd(varNameWidth);
          console.log(`    - ${paddedVarName} = "${service.imageTag}"`);
        }
      }
    }

    // 8. Generate dotfile if requested
    if (options.dotFile) {
      logger.verbose(`Generating DOT file: ${options.dotFile}`);
      // Use image ancestry tree for DOT files to show build dependencies
      const dotDependencyTree = buildImageAncestryTree(allBakeTargets);
      generateDotFile(config, dotDependencyTree, options.dotFile);
      logger.success(`Generated ${options.dotFile}`);
    }

    // 9. Generate ASCII tree if requested
    if (options.ascii) {
      logger.verbose("Generating ASCII tree visualization...");
      const treeGenerator = new AsciiTreeGenerator();
      const dependencyMap = buildDependencyMap(dependencyTree);
      const asciiTree = treeGenerator.generateTree(
        allBakeTargets,
        dependencyMap,
        options.inputFile,
        projectConfig.bake || [],
      );
      console.log(asciiTree);
    }

    const resolvedTagRecord = Object.fromEntries(resolvedTags.entries());

    return {
      success: true,
      outputFile,
      projectContext: contextDir,
      project: projectConfig,
      servicesCalculated: generatedServices.length,
      generatedServices,
      resolvedTags: resolvedTagRecord,
      composeFiles,
      bakeTargets: allBakeTargets,
    };
  } catch (error) {
    if (error instanceof CyclicDependencyError) {
      const errorMsg = `Cyclic dependencies detected: ${error.cycles.map((cycle) => cycle.join(" -> ")).join(", ")}`;
      logger.error(errorMsg);
      const project = projectConfig ?? { name: "orcka", bake: [] };
      return {
        success: false,
        outputFile,
        projectContext: contextDir,
        project,
        servicesCalculated: 0,
        generatedServices: [],
        resolvedTags: {},
        composeFiles,
        bakeTargets: allBakeTargets,
        errors: [errorMsg],
      };
    }

    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error(errorMsg);
    const project = projectConfig ?? { name: "orcka", bake: [] };
    return {
      success: false,
      outputFile,
      projectContext: contextDir,
      project,
      servicesCalculated: 0,
      generatedServices: [],
      resolvedTags: {},
      composeFiles,
      bakeTargets: allBakeTargets,
      errors: [errorMsg],
    };
  }
}

export * from "./types.js";
