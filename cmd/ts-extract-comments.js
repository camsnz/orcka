#!/usr/bin/env node

/**
 * TypeScript Comment Extraction Tool
 * 
 * Finds functions with long explanatory comments that indicate the need for
 * better semantic naming or function extraction.
 * 
 * Usage:
 *   node cmd/ts-extract-comments.js [--file src/path/to/file.ts] [--min-lines 3]
 */

import { resolve } from 'path';
import { Project, SyntaxKind } from 'ts-morph';

const args = process.argv.slice(2);
const fileFlag = args.indexOf('--file');
const minLinesFlag = args.indexOf('--min-lines');
const targetFile = fileFlag !== -1 ? args[fileFlag + 1] : null;
const minLines = minLinesFlag !== -1 ? parseInt(args[minLinesFlag + 1]) : 3;

console.log(`🔍 Finding functions with explanatory comments (${minLines}+ lines)...\n`);

const project = new Project({
  tsConfigFilePath: resolve(process.cwd(), 'tsconfig.json'),
});

function analyzeComments(func, sourceFile) {
  const name = func.getName();
  const leadingComments = func.getLeadingCommentRanges();
  const jsDocComments = func.getJsDocs();
  
  const analysis = {
    name,
    file: sourceFile.getBaseName(),
    filePath: sourceFile.getFilePath(),
    line: func.getStartLineNumber(),
    issues: []
  };

  // Analyze JSDoc comments
  jsDocComments.forEach(jsDoc => {
    const comment = jsDoc.getText();
    const lines = comment.split('\n').length;
    
    if (lines >= minLines) {
      // Check for architectural explanations
      if (comment.includes('ARCHITECTURE') || comment.includes('NOTE:')) {
        analysis.issues.push({
          type: 'architectural-explanation',
          lines,
          reason: 'Contains architectural explanations that suggest naming issues',
          comment: comment.substring(0, 200) + (comment.length > 200 ? '...' : '')
        });
      }
      
      // Check for implementation details
      if (comment.includes('This is a') || comment.includes('temporary solution')) {
        analysis.issues.push({
          type: 'implementation-detail',
          lines,
          reason: 'Explains implementation details that should be in code structure',
          comment: comment.substring(0, 200) + (comment.length > 200 ? '...' : '')
        });
      }
      
      // Check for usage explanations
      if (comment.includes('For now') || comment.includes('until we can')) {
        analysis.issues.push({
          type: 'temporary-solution',
          lines,
          reason: 'Describes temporary solution - consider refactoring',
          comment: comment.substring(0, 200) + (comment.length > 200 ? '...' : '')
        });
      }
      
      // Check for multiple responsibilities
      if (comment.includes('1.') && comment.includes('2.') && comment.includes('3.')) {
        analysis.issues.push({
          type: 'multiple-responsibilities',
          lines,
          reason: 'Lists multiple responsibilities - consider function extraction',
          comment: comment.substring(0, 200) + (comment.length > 200 ? '...' : '')
        });
      }
    }
  });

  return analysis;
}

function suggestRefactoring(analysis) {
  const suggestions = [];
  
  analysis.issues.forEach(issue => {
    switch (issue.type) {
      case 'architectural-explanation':
        suggestions.push(`Consider renaming '${analysis.name}' to be more self-explanatory`);
        suggestions.push(`Extract architectural concerns into separate modules`);
        break;
        
      case 'implementation-detail':
        suggestions.push(`Rename '${analysis.name}' to reflect its actual purpose`);
        suggestions.push(`Move implementation details into the code structure`);
        break;
        
      case 'temporary-solution':
        suggestions.push(`Refactor '${analysis.name}' to remove temporary aspects`);
        suggestions.push(`Create proper abstraction for the intended solution`);
        break;
        
      case 'multiple-responsibilities':
        suggestions.push(`Extract separate functions from '${analysis.name}'`);
        suggestions.push(`Use composition to combine smaller, focused functions`);
        break;
    }
  });
  
  return [...new Set(suggestions)]; // Remove duplicates
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
  
  let foundIssues = false;
  
  allFunctions.forEach(func => {
    const analysis = analyzeComments(func, sourceFile);
    
    if (analysis.issues.length > 0) {
      foundIssues = true;
      console.log(`  🚨 ${analysis.name} (line ${analysis.line})`);
      
      analysis.issues.forEach(issue => {
        console.log(`    📝 ${issue.type} (${issue.lines} lines): ${issue.reason}`);
        console.log(`       "${issue.comment.replace(/\n/g, ' ').trim()}"`);
      });
      
      const suggestions = suggestRefactoring(analysis);
      if (suggestions.length > 0) {
        console.log(`    💡 Suggestions:`);
        suggestions.forEach(suggestion => {
          console.log(`       → ${suggestion}`);
        });
      }
      
      console.log('');
    }
  });
  
  if (!foundIssues) {
    console.log('  ✅ No problematic comments found\n');
  }
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

  console.log(`
💡 Refactoring Tips:
   • Long comments often indicate naming problems
   • Extract functions with single responsibilities
   • Use semantic names that explain the 'what', not the 'how'
   • Move architectural explanations to module-level documentation

🔧 Use these tools to refactor:
   node cmd/ts-rename.js function oldName newName
   node cmd/ts-analyze-names.js --file path/to/file.ts
`);
}

main();
