#!/usr/bin/env node

/**
 * TypeScript Semantic Renaming Tool
 * 
 * Safely rename functions, classes, variables, and files while updating all references
 * across the entire project using ts-morph's semantic analysis.
 * 
 * Usage:
 *   node cmd/ts-rename.js function oldName newName [--file src/path/to/file.ts]
 *   node cmd/ts-rename.js class OldClass NewClass
 *   node cmd/ts-rename.js variable oldVar newVar --file src/utils/file.ts
 *   node cmd/ts-rename.js file old-file.ts new-file.ts
 */

import { existsSync, renameSync } from 'fs';
import { basename, dirname, extname, resolve } from 'path';
import { Project } from 'ts-morph';

const args = process.argv.slice(2);

if (args.length < 3) {
  console.error(`
Usage: node cmd/ts-rename.js <type> <oldName> <newName> [options]

Types:
  function    Rename a function and all its references
  class       Rename a class and all its references  
  variable    Rename a variable and all its references
  interface   Rename an interface and all its references
  type        Rename a type alias and all its references
  file        Rename a file and update all imports

Options:
  --file <path>    Limit scope to specific file (for function/variable/class)
  --dry-run        Show what would be renamed without making changes

Examples:
  node cmd/ts-rename.js function readHclFile parseHclFileSync
  node cmd/ts-rename.js class HclParser HclFileParser
  node cmd/ts-rename.js file src/utils/file-utils.ts src/utils/file-operations.ts
  node cmd/ts-rename.js function validateDockerShaFile validateDockerConfig --file src/core/validation/
`);
  process.exit(1);
}

const [type, oldName, newName] = args;
const fileFlag = args.indexOf('--file');
const dryRun = args.includes('--dry-run');
const targetFile = fileFlag !== -1 ? args[fileFlag + 1] : null;

console.log(`🔄 ${dryRun ? '[DRY RUN] ' : ''}Renaming ${type}: ${oldName} → ${newName}`);

const project = new Project({
  tsConfigFilePath: resolve(process.cwd(), 'tsconfig.json'),
});

async function renameFunction() {
  const sourceFiles = targetFile 
    ? [project.getSourceFile(resolve(process.cwd(), targetFile))]
    : project.getSourceFiles();

  let renamed = false;

  for (const sourceFile of sourceFiles) {
    if (!sourceFile) continue;

    const functions = sourceFile.getFunctions().filter(f => f.getName() === oldName);
    const methods = sourceFile.getClasses()
      .flatMap(c => c.getMethods())
      .filter(m => m.getName() === oldName);
    
    [...functions, ...methods].forEach(func => {
      console.log(`  📍 Found in: ${sourceFile.getFilePath()}`);
      
      if (!dryRun) {
        func.rename(newName);
        renamed = true;
      }
    });
  }

  if (renamed && !dryRun) {
    await project.save();
    console.log(`✅ Successfully renamed function ${oldName} → ${newName}`);
  }
}

async function renameClass() {
  const sourceFiles = targetFile 
    ? [project.getSourceFile(resolve(process.cwd(), targetFile))]
    : project.getSourceFiles();

  let renamed = false;

  for (const sourceFile of sourceFiles) {
    if (!sourceFile) continue;

    const classes = sourceFile.getClasses().filter(c => c.getName() === oldName);
    
    classes.forEach(cls => {
      console.log(`  📍 Found class in: ${sourceFile.getFilePath()}`);
      
      if (!dryRun) {
        cls.rename(newName);
        renamed = true;
      }
    });
  }

  if (renamed && !dryRun) {
    await project.save();
    console.log(`✅ Successfully renamed class ${oldName} → ${newName}`);
  }
}

async function renameInterface() {
  const sourceFiles = targetFile 
    ? [project.getSourceFile(resolve(process.cwd(), targetFile))]
    : project.getSourceFiles();

  let renamed = false;

  for (const sourceFile of sourceFiles) {
    if (!sourceFile) continue;

    const interfaces = sourceFile.getInterfaces().filter(i => i.getName() === oldName);
    
    interfaces.forEach(iface => {
      console.log(`  📍 Found interface in: ${sourceFile.getFilePath()}`);
      
      if (!dryRun) {
        iface.rename(newName);
        renamed = true;
      }
    });
  }

  if (renamed && !dryRun) {
    await project.save();
    console.log(`✅ Successfully renamed interface ${oldName} → ${newName}`);
  }
}

async function renameFile() {
  const oldPath = resolve(process.cwd(), oldName);
  const newPath = resolve(process.cwd(), newName);
  
  if (!existsSync(oldPath)) {
    console.error(`❌ File not found: ${oldPath}`);
    process.exit(1);
  }

  const sourceFile = project.getSourceFile(oldPath);
  if (!sourceFile) {
    console.error(`❌ TypeScript file not found in project: ${oldPath}`);
    process.exit(1);
  }

  console.log(`  📍 Moving: ${oldPath} → ${newPath}`);

  // Find all files that import this file
  const referencingFiles = project.getSourceFiles().filter(sf => {
    return sf.getImportDeclarations().some(imp => {
      const moduleSpecifier = imp.getModuleSpecifierValue();
      return moduleSpecifier.includes(basename(oldName, extname(oldName)));
    });
  });

  console.log(`  📍 Found ${referencingFiles.length} files with imports to update`);

  if (!dryRun) {
    // Move the file
    sourceFile.move(newPath);
    
    // Update all import paths
    referencingFiles.forEach(refFile => {
      const imports = refFile.getImportDeclarations();
      imports.forEach(imp => {
        const moduleSpecifier = imp.getModuleSpecifierValue();
        if (moduleSpecifier.includes(basename(oldName, extname(oldName)))) {
          const newModuleSpecifier = moduleSpecifier.replace(
            basename(oldName, extname(oldName)),
            basename(newName, extname(newName))
          );
          imp.setModuleSpecifier(newModuleSpecifier);
          console.log(`    🔗 Updated import in: ${refFile.getFilePath()}`);
        }
      });
    });

    await project.save();
    console.log(`✅ Successfully moved file and updated ${referencingFiles.length} import references`);
  }
}

async function main() {
  try {
    switch (type) {
      case 'function':
        await renameFunction();
        break;
      case 'class':
        await renameClass();
        break;
      case 'interface':
        await renameInterface();
        break;
      case 'type':
        await renameInterface(); // Type aliases use same logic
        break;
      case 'file':
        await renameFile();
        break;
      default:
        console.error(`❌ Unknown type: ${type}`);
        process.exit(1);
    }

    if (dryRun) {
      console.log(`\n💡 This was a dry run. Use without --dry-run to apply changes.`);
    }
  } catch (error) {
    console.error(`❌ Error during renaming:`, error.message);
    process.exit(1);
  }
}

main();
