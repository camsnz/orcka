#!/usr/bin/env node

/**
 * TypeScript Semantic Name Analysis Tool
 * 
 * Analyzes function names and suggests more semantic alternatives based on:
 * - Function body analysis
 * - Parameter types and names
 * - Return type analysis
 * - Usage patterns
 * 
 * Usage:
 *   node cmd/ts-analyze-names.js [--file src/path/to/file.ts] [--suggest-renames]
 */

import { resolve } from 'path';
import { Project, SyntaxKind } from 'ts-morph';

const args = process.argv.slice(2);
const fileFlag = args.indexOf('--file');
const suggestRenames = args.includes('--suggest-renames');
const targetFile = fileFlag !== -1 ? args[fileFlag + 1] : null;

console.log('🔍 Analyzing function names for semantic clarity...\n');

const project = new Project({
  tsConfigFilePath: resolve(process.cwd(), 'tsconfig.json'),
});

// Common semantic patterns for better naming
const SEMANTIC_PATTERNS = {
  // Action patterns
  'read': ['load', 'fetch', 'get', 'retrieve'],
  'write': ['save', 'store', 'persist', 'create'],
  'parse': ['decode', 'transform', 'convert', 'extract'],
  'validate': ['check', 'verify', 'ensure', 'assert'],
  'generate': ['create', 'build', 'produce', 'construct'],
  'calculate': ['compute', 'determine', 'derive', 'evaluate'],
  
  // Data type patterns
  'File': ['Document', 'Resource', 'Asset'],
  'Data': ['Content', 'Payload', 'Information'],
  'Config': ['Settings', 'Options', 'Parameters'],
  'Result': ['Output', 'Response', 'Outcome'],
};

function analyzeFunction(func, sourceFile) {
  const name = func.getName();
  const parameters = func.getParameters();
  const returnType = func.getReturnTypeNode()?.getText() || 'unknown';
  const body = func.getBody();
  
  const analysis = {
    name,
    file: sourceFile.getBaseName(),
    parameters: parameters.map(p => ({
      name: p.getName(),
      type: p.getTypeNode()?.getText() || 'any'
    })),
    returnType,
    bodyLength: body?.getStatements().length || 0,
    suggestions: []
  };

  // Analyze function body for semantic clues
  if (body) {
    const bodyText = body.getText();
    const statements = body.getStatements();
    
    // Check for file operations
    if (bodyText.includes('readFileSync') || bodyText.includes('readFile')) {
      analysis.suggestions.push({
        type: 'action',
        reason: 'Function reads files',
        suggestions: name.includes('read') ? ['loadFile', 'fetchFile'] : ['readFile', 'loadFile']
      });
    }
    
    if (bodyText.includes('writeFileSync') || bodyText.includes('writeFile')) {
      analysis.suggestions.push({
        type: 'action',
        reason: 'Function writes files',
        suggestions: name.includes('write') ? ['saveFile', 'storeFile'] : ['writeFile', 'saveFile']
      });
    }
    
    // Check for parsing operations
    if (bodyText.includes('JSON.parse') || bodyText.includes('yaml.parse') || bodyText.includes('parse')) {
      analysis.suggestions.push({
        type: 'action',
        reason: 'Function parses data',
        suggestions: ['parseContent', 'decodeData', 'transformInput']
      });
    }
    
    // Check for validation patterns
    if (bodyText.includes('throw new Error') || bodyText.includes('return { success: false')) {
      analysis.suggestions.push({
        type: 'action',
        reason: 'Function validates input',
        suggestions: ['validateInput', 'checkData', 'verifyContent']
      });
    }
    
    // Check for async patterns
    if (func.isAsync() && !name.includes('Async')) {
      analysis.suggestions.push({
        type: 'convention',
        reason: 'Async function should indicate async nature',
        suggestions: [`${name}Async`, `${name}Promise`]
      });
    }
    
    // Check for boolean returns
    if (returnType.includes('boolean') && !name.startsWith('is') && !name.startsWith('has') && !name.startsWith('can')) {
      analysis.suggestions.push({
        type: 'convention',
        reason: 'Boolean return should use predicate naming',
        suggestions: [`is${capitalize(name)}`, `has${capitalize(name)}`, `can${capitalize(name)}`]
      });
    }
    
    // Check for generic names that could be more specific
    const genericNames = ['process', 'handle', 'manage', 'do', 'run', 'execute'];
    if (genericNames.some(generic => name.toLowerCase().includes(generic))) {
      analysis.suggestions.push({
        type: 'specificity',
        reason: 'Generic name could be more specific',
        suggestions: analyzeBodyForSpecificAction(bodyText, name)
      });
    }
  }
  
  return analysis;
}

function analyzeBodyForSpecificAction(bodyText, currentName) {
  const suggestions = [];
  
  if (bodyText.includes('calculate') || bodyText.includes('compute')) {
    suggestions.push(currentName.replace(/process|handle|manage/, 'calculate'));
  }
  
  if (bodyText.includes('validate') || bodyText.includes('check')) {
    suggestions.push(currentName.replace(/process|handle|manage/, 'validate'));
  }
  
  if (bodyText.includes('transform') || bodyText.includes('convert')) {
    suggestions.push(currentName.replace(/process|handle|manage/, 'transform'));
  }
  
  return suggestions.length > 0 ? suggestions : ['refineAction', 'specifyPurpose'];
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function analyzeFile(sourceFile) {
  console.log(`📁 ${sourceFile.getFilePath()}`);
  
  const functions = sourceFile.getFunctions();
  const methods = sourceFile.getClasses().flatMap(cls => cls.getMethods());
  const allFunctions = [...functions, ...methods];
  
  if (allFunctions.length === 0) {
    console.log('  ℹ️  No functions found\n');
    return;
  }
  
  allFunctions.forEach(func => {
    const analysis = analyzeFunction(func, sourceFile);
    
    console.log(`  🔧 ${analysis.name}(${analysis.parameters.map(p => `${p.name}: ${p.type}`).join(', ')}) → ${analysis.returnType}`);
    
    if (analysis.suggestions.length > 0) {
      analysis.suggestions.forEach(suggestion => {
        console.log(`    💡 ${suggestion.reason}:`);
        suggestion.suggestions.forEach(name => {
          console.log(`       → ${name}`);
        });
      });
    } else {
      console.log(`    ✅ Name appears semantic and clear`);
    }
    
    console.log('');
  });
}

function main() {
  const sourceFiles = targetFile 
    ? [project.getSourceFile(resolve(process.cwd(), targetFile))]
    : project.getSourceFiles().filter(sf => 
        sf.getFilePath().includes('/src/') && 
        !sf.getFilePath().includes('.spec.') &&
        !sf.getFilePath().includes('.test.')
      );

  if (sourceFiles.length === 0) {
    console.log('❌ No TypeScript files found to analyze');
    process.exit(1);
  }

  sourceFiles.forEach(sourceFile => {
    if (sourceFile) {
      analyzeFile(sourceFile);
    }
  });

  if (suggestRenames) {
    console.log(`
💡 To rename functions safely, use:
   node cmd/ts-rename.js function oldName newName [--file path/to/file.ts]

Example:
   node cmd/ts-rename.js function readHclFile parseHclFileSync --file src/utils/file-utils.ts
`);
  }
}

main();
