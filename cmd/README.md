# TypeScript Refactoring Tools

This directory contains semantic refactoring tools built with `ts-morph` to help maintain clean, self-documenting code.

## Philosophy

> **"Code should explain itself through semantic naming, not through explanatory comments."**

Long explanatory comments often indicate:
- Functions with unclear names
- Multiple responsibilities in one function  
- Missing abstractions
- Architectural concerns mixed with implementation

These tools help identify and fix these issues systematically.

## Tools

### 🔧 `ts-rename.js` - Safe Semantic Renaming

Safely rename functions, classes, variables, and files while updating all references across the project using TypeScript's semantic analysis.

```bash
# Rename a function and all its references
node cmd/ts-rename.js function oldName newName [--file src/path/to/file.ts]

# Rename a class across the entire project
node cmd/ts-rename.js class OldClass NewClass

# Rename a file and update all imports
node cmd/ts-rename.js file old-file.ts new-file.ts

# Dry run to see what would be changed
node cmd/ts-rename.js function readHclFile parseHclForValidation --dry-run
```

**Examples:**
```bash
# Make function names more semantic
node cmd/ts-rename.js function readHclFile parseHclForValidation
node cmd/ts-rename.js function processData transformUserInput
node cmd/ts-rename.js function handleRequest validateAndProcessRequest

# Improve class names
node cmd/ts-rename.js class DataProcessor UserInputTransformer
node cmd/ts-rename.js class Manager ConfigurationValidator
```

### 🔍 `ts-analyze-names.js` - Semantic Name Analysis

Analyzes function names and suggests more semantic alternatives based on function body analysis, parameter types, and usage patterns.

```bash
# Analyze all functions in the project
node cmd/ts-analyze-names.js --suggest-renames

# Analyze specific file
node cmd/ts-analyze-names.js --file src/utils/file-utils.ts --suggest-renames
```

**What it detects:**
- Generic names that could be more specific (`process`, `handle`, `manage`)
- Missing async indicators (`fetchData` should be `fetchDataAsync`)
- Boolean functions without predicate naming (`valid` should be `isValid`)
- Functions that don't match their actual behavior

### 📝 `ts-extract-comments.js` - Comment Analysis

Finds functions with long explanatory comments that indicate naming or structural problems.

```bash
# Find all problematic comments
node cmd/ts-extract-comments.js

# Analyze specific file
node cmd/ts-extract-comments.js --file src/utils/file-utils.ts

# Adjust sensitivity (default: 3+ lines)
node cmd/ts-extract-comments.js --min-lines 5
```

**What it identifies:**
- **Architectural explanations** → Need better module organization
- **Implementation details** → Need more semantic function names
- **Temporary solutions** → Need proper refactoring
- **Multiple responsibilities** → Need function extraction

## Workflow Example

Here's how to systematically improve code quality:

### 1. Identify Problems
```bash
# Find functions with explanatory comments
node cmd/ts-extract-comments.js --file src/utils/file-utils.ts
```

### 2. Analyze Names
```bash
# Get semantic naming suggestions
node cmd/ts-analyze-names.js --file src/utils/file-utils.ts --suggest-renames
```

### 3. Apply Improvements
```bash
# Rename functions to be more semantic
node cmd/ts-rename.js function readHclFile parseHclForValidation --file src/utils/file-utils.ts

# Test that everything still works
pnpm test
```

### 4. Clean Up Comments
After renaming, remove explanatory comments that are no longer needed:

**Before:**
```typescript
/**
 * Read and parse HCL file with error handling using regex-based parser
 * 
 * ARCHITECTURE NOTE:
 * This is a synchronous, regex-based HCL parser used for validation purposes.
 * For the main calculation pipeline, use @cdktf/hcl2json (async, more robust).
 * 
 * This parser is sufficient for validation because:
 * 1. It correctly extracts depends_on fields for cycle detection
 * 2. It handles basic target structures needed for validation
 * 3. It keeps validation synchronous (simpler error handling)
 */
export function readHclFile(filePath: string) {
  // Implementation...
}
```

**After:**
```typescript
/**
 * Parse HCL file synchronously for validation purposes using regex extraction
 */
export function parseHclForValidation(filePath: string) {
  // Implementation...
}
```

## Best Practices

### Semantic Naming Patterns

**Actions:**
- `read` → `load`, `fetch`, `retrieve`
- `write` → `save`, `store`, `persist`
- `parse` → `decode`, `transform`, `extract`
- `validate` → `check`, `verify`, `ensure`
- `generate` → `create`, `build`, `produce`

**Predicates (boolean returns):**
- `isValid()`, `hasPermission()`, `canAccess()`
- Not: `valid()`, `permission()`, `access()`

**Async functions:**
- `fetchDataAsync()`, `loadConfigAsync()`
- Or use Promise suffix: `fetchDataPromise()`

**Specificity over generics:**
- `validateDockerConfig()` not `processData()`
- `transformUserInput()` not `handleRequest()`
- `calculateDockerSha()` not `doCalculation()`

### When to Extract Functions

Extract when you see:
- Functions with multiple responsibilities (comments listing 1, 2, 3...)
- Long explanatory comments about what the function does
- Generic names like `process`, `handle`, `manage`
- Functions that are hard to name because they do too much

### Integration with Development Workflow

```bash
# Add to package.json scripts
{
  "scripts": {
    "refactor:analyze": "node cmd/ts-analyze-names.js --suggest-renames",
    "refactor:comments": "node cmd/ts-extract-comments.js",
    "refactor:rename": "node cmd/ts-rename.js"
  }
}

# Use in CI/CD to catch naming issues
npm run refactor:comments
npm run refactor:analyze
```

## Dependencies

- `ts-morph`: TypeScript compiler API for semantic analysis and refactoring
- Requires valid `tsconfig.json` in project root

## Safety

All renaming operations:
- ✅ Use TypeScript's semantic analysis (not text search/replace)
- ✅ Update all references across the project
- ✅ Preserve type information
- ✅ Support dry-run mode
- ✅ Maintain import/export relationships

Always run tests after refactoring to ensure behavior is preserved.
