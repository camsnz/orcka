# Agent Development Guidelines

## Core Principles

### Test-Driven Development
- **Requirements → Tests → Implementation**: Create comprehensive test expectations first to define specifications
- **Test coverage is documentation**: Tests serve as living documentation of application behavior
- **No untested code**: All new functionality must have corresponding test coverage

### Test Classification

Tests are organized in a three-tier hierarchy optimized for speed and reliability:

#### Unit Tests (`pnpm test`)
- **Scope**: Individual functions, modules, and components in isolation
- **Dependencies**: Fully mocked; no file system or external processes
- **Speed**: Very fast (< 20 seconds)
- **Purpose**: Validate internal logic, algorithms, and data transformations
- **When to run**: Continuously during development, CI, and health checks

#### Contract Tests (`pnpm test:contract`)
- **Scope**: Compiled application behavior testing the public interface
- **Dependencies**: Requires built artifacts (`bin/orcka.cjs`); file system allowed; external services mocked
- **Speed**: Moderate (1-3 minutes)
- **Purpose**: Validate functional requirements, CLI behavior, and component integration
- **When to run**: Before commits, CI, and health checks

#### System Tests (`pnpm test:system`)
- **Scope**: Full system validation against real external dependencies
- **Dependencies**: Real Docker daemon, registries, file systems, network calls
- **Speed**: Slow (5+ minutes)
- **Purpose**: Validate end-to-end workflows in realistic deployment scenarios
- **When to run**: After successful CI build, before deployment
- **Note**: Not yet implemented

#### Code Coverage Signals
Coverage is a signal for investigation, not an absolute quality metric:
- **100% MAX** (GREEN) / **90% HIGH** (BLUE) / **80% GOOD** (CYAN): Excellent
- **70% SOLID** (WHITE) / **60% OK** (YELLOW): Adequate
- **50% LOW** (ORANGE) / **40% POOR** (RED) / **30% AWFUL** (PURPLE): Insufficient

### Build Validation
- **Run `task health` frequently**: Validate stable build criteria before completing work
- **Zero tolerance**: All tests must pass, linting clean, builds succeed
- **Early validation**: Check during development, not just at completion

#### Issue Resolution Priority
1. **Compile Errors**: Fix TypeScript compilation first - nothing works without a build
2. **File Size**: Address files exceeding LLM limits (~350 lines) for development efficiency
3. **Failing Tests**: Ensure all tests pass to maintain behavioral correctness
4. **Linting**: Clean up code style and quality issues

## Code Quality Standards

### Modularity & Testability
- **Single Responsibility**: Each module/function does one thing well
- **Testable design**: Structure code to enable easy unit testing
- **Clear interfaces**: Well-defined and documented public APIs
- **Minimal dependencies**: Reduce coupling between modules

### Code Readability & Reusability
- **Extract helper methods**: Convert repeated patterns into well-named functions
- **Declarative over imperative**: Express *what* rather than *how*
- **DRY principle**: Centralize common operations in reusable functions
- **Self-documenting**: Method names clearly communicate purpose and behavior
- **Prefer composition**: Build complex functionality from simple, well-tested helpers
- **Use data structures**: Define configurations, mappings, and rules as data

### Refactoring: Domain-Based File Splitting

When a cohesive file exceeds size limits (~350 lines):

**Process:**
1. Create subdirectory using original filename
2. Split by sub-responsibilities into logical files
3. Create `index.ts` with dual exports (namespace + individual)
4. Remove `.js` extensions from all imports
5. Update test mocks to new paths
6. Validate with full test suite

**Critical index.ts Pattern:**
```typescript
// Import functions
import { formatText } from "./text";
import { formatNumber } from "./number";

// Export as namespace (for existing consumers)
export const Formatter = { formatText, formatNumber };

// Export individually (CRITICAL - enables direct imports)
export { formatText, formatNumber };
```

**Example:**
```
Before: src/utils/formatter.ts (400 lines)
        import { formatText } from "./formatter.js"; ❌

After:  src/utils/formatter/
        ├── index.ts    (dual exports)
        ├── text.ts     (text formatting)
        ├── number.ts   (number formatting)
        └── date.ts     (date formatting)
        import { formatText } from "./formatter"; ✅
```

### Common Refactoring Pitfalls

**1. Incomplete index.ts re-exports**
- **Symptom**: Tests fail with "is not a function"
- **Cause**: Only namespace export, missing individual function exports
- **Fix**: Export both as namespace properties AND individual named exports

**2. Stale test mock paths**
- **Symptom**: Tests fail with process.exit() despite mocked functions
- **Cause**: `vi.doMock()` paths not updated after module moves
- **Fix**: Update all mock paths to match new import paths

**3. Incorrect file extensions**
- **Symptom**: Module resolution failures in tests
- **Cause**: Using `.js` extensions in TypeScript source imports
- **Fix**: Use extensionless imports (TypeScript handles resolution)

**4. Incomplete test mocks**
- **Symptom**: Code fails accessing expected object properties
- **Cause**: Mocks missing required fields after refactoring
- **Fix**: Use test helper functions (e.g., `createStatResult()`)

### Post-Refactoring Validation Checklist
- [ ] `pnpm test` - all unit tests pass
- [ ] `pnpm test:contract` - all contract tests pass
- [ ] `pnpm build` - TypeScript compilation succeeds
- [ ] Search and update old import paths
- [ ] Test mocks reference correct module paths
- [ ] index.ts files export namespace AND individual functions

### Type Optimization
- **Trust inference**: Let TypeScript infer obvious types
- **Preserve critical types**: Keep explicit types for public APIs and complex interfaces
- **Remove redundancy**: Avoid types TypeScript can infer from context

### File Size Management
- **Limits**: Keep files within LLM context (~300-400 lines)
- **Monitoring**: `task health` flags BAD/WARN sizes - treat as must-fix
- **Smart splitting**: Ensure logical separation exists; cohesion over arbitrary size
- **Extract first**: Look for repeated patterns or type declaration optimization before splitting

### Dead Code Management
- **Detection**: Use automated analysis (`pnpm knip`) to identify unused files
- **Validation**: Analysis is heuristic - requires manual verification
- **Removal Contract** - Remove ONLY when ALL conditions met:
  1. ✅ Code compiles successfully
  2. ✅ All unit tests pass
  3. ✅ Contract tests pass
  4. ✅ Manual verification (not used via dynamic imports, config, runtime loading)
- **Safety First**: When in doubt, keep code and mark with TODO

## Development Workflow

1. **Define**: Write test specifications to capture requirements
2. **Implement**: Satisfy tests using helper methods and declarative patterns
3. **Extract**: Convert common patterns into reusable functions during implementation
4. **Validate**: Run `task health` throughout development
5. **Refactor**: Address size thresholds and complexity; maintain test coverage
6. **Verify**: Tests remain the source of truth for behavior

### Code Patterns to Extract
- **Repeated conditional logic**: `isValid()`, `shouldProcess()` helpers
- **Complex transformations**: `transformData()`, `mapToFormat()` functions
- **Validation patterns**: `validateInput()`, `checkRequirements()` methods
- **Error handling**: `handleError()`, `createErrorResponse()` utilities
- **String/path manipulation**: `buildPath()`, `formatMessage()` helpers
- **Configuration parsing**: `parseConfig()`, `loadSettings()` functions

### File Organization Boundaries
Split files along natural boundaries:
- **Lifecycle**: Initialization vs runtime vs cleanup
- **Responsibility**: Transformation vs validation vs I/O
- **Abstraction**: Low-level utilities vs high-level operations
- **Feature area**: Different aspects of same domain
- **Visibility**: Internal helpers vs public API

## Quality Gates

- ✅ All tests passing
- ✅ No linting errors
- ✅ Build succeeds
- ✅ Files within size thresholds
- ✅ Test coverage maintained
- ✅ Documentation updated

*Keep code modular, testable, and within cognitive limits. Let tests define the specification.*
