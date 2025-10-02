# Dual Tagging Technical Design

## Problem Statement

When building with `docker buildx bake`, targets currently receive only the orcka-calculated SHA-based tag. However, docker-compose files reference images with their "target" tags (e.g., `myapp:v1.0`, `myapp:latest`, or `myapp:${VERSION-latest}`).

**Critical Issue**: Pre-existing images with commonly reused tags (like `:latest` or `:v1.0`) may be old/stale versions. When docker-compose starts services, it might use these old local images instead of the freshly built ones.

**Solution**: Each target must receive **both tags simultaneously** during the bake process:
1. **Orcka calculated tag**: `myapp:sha-20250101-abc123def` (deterministic, content-based)
2. **Compose target tag**: `myapp:v1.0` (the tag referenced in docker-compose.yml)

## Current Architecture

### Tag Generation Flow
```
docker-sha.yml (config)
    ↓
calculateDockerSha()
    ↓
buildHashInput() → generateTagVersion()
    ↓
docker-orcka.tags.hcl (generated)
    ↓
docker buildx bake [targets] --file docker-bake.hcl --file docker-orcka.tags.hcl
    ↓
Images tagged with orcka tags only
```

### Key Files
- `src/core/calculation/docker-sha/index.ts` - Main calculation orchestrator
- `src/core/calculation/tag-builder.ts` - Tag generation logic
- `src/generators/hcl/hcl-generator.ts` - HCL file generation
- `src/docker/bake/docker-bake-executor.ts` - Bake command execution
- `src/docker/compose/docker-compose-modifier.ts` - Compose file parsing

## Design: Dual Tagging Implementation

### Phase 1: Compose Tag Resolution

#### 1.1 Parse Compose Files for Target Tags

**Location**: New utility in `src/docker/compose/compose-tag-resolver.ts`

```typescript
interface ComposeImageTag {
  serviceName: string;
  imageName: string;
  tag: string;           // Resolved tag value
  originalTag: string;   // As specified in compose file
  hasVariables: boolean; // true if contains ${...}
}

interface ComposeTagResolutionResult {
  tags: ComposeImageTag[];
  warnings: string[];
}

/**
 * Extracts and resolves image tags from compose files
 * Handles:
 * - Static tags: myapp:v1.0
 * - Env vars with defaults: myapp:${VERSION-latest}
 * - Implicit latest: myapp (becomes myapp:latest)
 * - Variable substitution: myapp:${VERSION} (uses process.env)
 */
export function resolveComposeTags(
  composeFiles: string[],
  options?: {
    env?: Record<string, string>;
    applyMerging?: boolean;
  }
): ComposeTagResolutionResult;
```

**Implementation Details**:
- Read and parse all compose files using `yaml` library
- Merge compose files in order (later files override earlier ones)
- For each service.image:
  - Extract image name and tag
  - If no tag: default to `:latest`
  - If has `${VAR-default}`: resolve with fallback
  - If has `${VAR}`: resolve from `process.env` or `options.env`
  - Track warnings for unresolved variables

**Edge Cases**:
- Multiple compose files overriding the same service
- Image references without registry (e.g., `nginx:latest` vs `docker.io/nginx:latest`)
- Port numbers in image names (e.g., `localhost:5000/myapp:v1`)
- Build-only services (no image tag)

#### 1.2 Match Compose Services to Bake Targets

**Challenge**: Service names in compose may differ from target names in bake files.

**Heuristic Matching**:
1. Exact name match (service `web` → target `web`)
2. Dash-to-underscore (service `api-gateway` → target `api_gateway`)
3. Image name match (service has `image: mycompany/api:v1` → target with `tags = ["mycompany/api"]`)

**Location**: Extend in `src/core/calculation/docker-sha/index.ts`

```typescript
interface ServiceTargetMapping {
  serviceName: string;
  targetName: string;
  composeTag: string;
  matchType: 'exact' | 'normalized' | 'image-based';
}

function matchServicesToTargets(
  composeTags: ComposeImageTag[],
  bakeTargets: Record<string, DockerBakeTarget>
): ServiceTargetMapping[];
```

### Phase 2: Enhanced Tag Generation

#### 2.1 Update GeneratedService Interface

**Location**: `src/core/calculation/docker-sha/types.ts`

```typescript
export interface GeneratedServiceResult {
  name: string;
  varName: string;
  imageTag: string;           // Orcka calculated tag
  imageReference: string;     // Full reference with orcka tag
  composeTag?: string;        // NEW: Target tag from compose file
  composeReference?: string;  // NEW: Full reference with compose tag
}
```

#### 2.2 Modify Tag Builder

**Location**: `src/core/calculation/tag-builder.ts`

Update `processService` to include compose tag:

```typescript
async function processService({
  serviceName,
  config,
  bakeTargets,
  resolvedTags,
  currentTime,
  projectDir,
  logger,
  buildHashInput,
  composeTagMap, // NEW parameter
}: ProcessServiceOptions): Promise<GeneratedService | null> {
  // ... existing logic ...
  
  const composeTag = composeTagMap?.get(serviceName);
  
  return {
    name: serviceName,
    varName,
    imageTag: tagVersion,
    imageReference: fullImageTag,
    composeTag: composeTag?.tag,
    composeReference: composeTag 
      ? `${imageName}:${composeTag.tag}` 
      : undefined,
  };
}
```

### Phase 3: Bake Execution Enhancement

#### 3.1 Multi-Tag Support in Bake

Docker buildx bake supports multiple tags via the `tags` array in HCL:

```hcl
target "web" {
  tags = [
    "myapp:sha-20250101-abc123",  # Orcka calculated
    "myapp:v1.0"                   # Compose target
  ]
}
```

**Location**: `src/generators/hcl/hcl-generator.ts`

Modify `generateCalculatedHcl` to include both tags:

```typescript
export function generateCalculatedHcl(
  config: DockerShaConfig,
  services: GeneratedServiceResult[],
  // ... existing params
): { hclOutput: string; /* ... */ } {
  
  for (const service of services) {
    const tags = [
      `"${service.imageReference}"`,  // Orcka calculated tag
    ];
    
    if (service.composeReference) {
      tags.push(`"${service.composeReference}"`);  // Compose target tag
    }
    
    // Generate target block with multiple tags
    const targetBlock = `
target "${service.name}" {
  tags = [
    ${tags.join(',\n    ')}
  ]
}`;
    // ...
  }
}
```

#### 3.2 Display Both Tags in Build Plans

**Location**: `src/utils/formatting/targets-display.ts`

Update display to show both tag types:

```typescript
export interface TargetDisplayData {
  name: string;
  calculationCriteria: string;
  tagVer: string;              // Orcka calculated tag
  composeTag?: string;         // NEW: Compose target tag
  status: string;
  requiredTarget?: string;
}

export function displayTargetsSection(targets: TargetDisplayData[]): void {
  const headers = ["Target", "Calc", "Orcka Tag", "Compose Tag"];
  const rows = targets.map((target) => [
    target.name,
    target.calculationCriteria,
    target.tagVer,
    target.composeTag || "n/a",
  ]);
  
  const table = Clout.table(headers, rows, {
    columnWidths: [18, 8, 32, 20],
    align: ["left", "left", "left", "left"],
    border: false,
    truncate: true,
  });
  
  console.log(table);
}
```

## Implementation Plan

### Step 1: Compose Tag Resolution (Foundation)
**Files to Create**:
- `src/docker/compose/compose-tag-resolver.ts`
- `src/docker/compose/compose-tag-resolver.spec.ts`

**Files to Modify**:
- `src/core/calculation/docker-sha/types.ts` (add composeTag fields)

**Tests**: 
- Parse various compose file formats
- Handle env var substitution
- Handle compose file merging
- Edge cases (no tag, port numbers, etc.)

**Validation**: Run `task health` after implementation

### Step 2: Tag Matching & Generation
**Files to Modify**:
- `src/core/calculation/docker-sha/index.ts` (integrate compose tag resolution)
- `src/core/calculation/tag-builder.ts` (include compose tags in results)

**Tests**:
- Service-to-target matching
- Tag propagation through pipeline
- Missing compose file scenarios

**Validation**: Run `task health`

### Step 3: HCL Generation & Display
**Files to Modify**:
- `src/generators/hcl/hcl-generator.ts` (multi-tag support)
- `src/generators/hcl/hcl-generator.spec.ts` (test dual tags)
- `src/utils/formatting/targets-display.ts` (display both tags)

**Tests**:
- Generated HCL with multiple tags
- Display formatting
- Missing compose tag handling

**Validation**: Run `task health`

### Step 4: Integration Testing
**Files to Create**:
- `src/core/calculation/docker-sha-dual-tagging.spec.ts` (integration test)

**Tests**:
- End-to-end dual tagging flow
- Verify bake command receives both tags
- Verify images are tagged with both tags (requires contract test)

**Validation**: 
- Run `task health:all-checks`
- Manual testing with example app

## Testing Strategy

### Unit Tests
- Compose tag resolution for various formats
- Tag matching algorithms
- HCL generation with dual tags
- Display formatting

### Contract Tests
- Full pipeline from config → bake execution
- Verify generated HCL structure
- Verify bake command arguments

### Integration Tests (Manual)
```bash
# In example-plain-app
cd app/example-plain-app

# Build with dual tags
orcka build

# Verify both tags exist
docker images | grep python-fast-api
# Should show:
# python-fast-api  sha-20250101-abc123  ...
# python-fast-api  latest               ...

# Start with compose - should use fresh images
orcka up

# Verify running containers use correct images
docker ps --format "table {{.Names}}\t{{.Image}}"
```

## Edge Cases & Considerations

### 1. Tag Conflicts
**Problem**: Compose tag already exists locally with different content

**Solution**: 
- Orcka tag is always applied first (deterministic)
- Compose tag overwrites any existing tag
- Log warning if overwriting existing tag
- Consider `--preserve-existing-tags` flag for safety

### 2. Registry Prefixes
**Problem**: `myapp:v1` vs `docker.io/myapp:v1` vs `localhost:5000/myapp:v1`

**Solution**:
- Extract base image name without registry
- Match on base name
- Preserve registry prefix from bake target definition
- Both tags use same registry

### 3. Services Without Compose Files
**Problem**: Bake targets that aren't in any compose file

**Solution**:
- Only orcka tag applied
- `composeTag` field remains undefined
- Display shows "n/a" for compose tag
- Works exactly as before (backward compatible)

### 4. Multiple Tags in Compose
**Problem**: Some services might use multiple tags in different environments

**Solution**:
- Phase 1: Support primary tag only (first encountered)
- Future: Support tag arrays from multiple compose files
- Configuration option to specify which compose file is "canonical"

## Backward Compatibility

**Critical**: This change must not break existing workflows.

**Guarantees**:
1. If no compose files exist: Behavior unchanged (orcka tag only)
2. Existing `docker-orcka.tags.hcl` format remains valid
3. CLI commands maintain same interface
4. Projects without compose continue working

**Migration**: None required - feature activates automatically when compose files are present.

## Performance Considerations

**Additional Overhead**:
- Parsing compose files: ~10-50ms (depends on file size)
- Tag matching: ~1-5ms
- HCL generation: ~1ms additional

**Total Impact**: <100ms additional latency - negligible for build workflows

## Security Considerations

**Environment Variable Exposure**:
- Compose tag resolution may expose env vars in logs
- Solution: Sanitize logging of resolved tags
- Never log actual env var values, only keys

**Tag Injection**:
- Malicious compose files could specify arbitrary tags
- Solution: Validate tag format (alphanumeric, dots, dashes, underscores only)
- Reject tags with shell metacharacters

## Future Enhancements

### Phase 2 Features (Post-MVP):
1. **Tag Aliases**: Support multiple compose tags per service
2. **Registry Analysis**: Track which registries are used (req4-5)
3. **Smart Tag Cleanup**: Remove old tags after successful build
4. **Tag Policy**: Configurable rules for which tags to apply

### Configuration Extensions:
```yaml
# docker-orcka.yaml
project:
  name: myapp
  bake: ["docker-bake.hcl"]
  write: .orcka/docker-orcka.tags.hcl
  
  # NEW: Dual tagging configuration
  tagging:
    compose_tags: true           # Enable dual tagging
    compose_files: ["docker-compose.yml"]  # Explicit compose files
    tag_policy: "overwrite"      # overwrite | preserve | warn
    primary_compose: "docker-compose.yml"  # For multi-file setups
```

## Open Questions for Review

1. **Tag Precedence**: Should compose tag or orcka tag be listed first in HCL?
   - Recommendation: Orcka first (primary), compose second (compatibility)

2. **Missing Tag Behavior**: What if compose file exists but service has no image tag?
   - Recommendation: Use `:latest` as default (Docker compose convention)

3. **Variable Resolution**: Should we support `.env` files for variable substitution?
   - Recommendation: Phase 2 - keep MVP simple with process.env only

4. **Build vs Runtime**: Should both tags appear in override file or just orcka tag?
   - Recommendation: Override file uses orcka tag (most specific/deterministic)

5. **Display Verbosity**: Show compose tags in quiet mode?
   - Recommendation: No - maintain current quiet mode behavior

## Success Criteria

✅ **MVP Complete When**:
1. Bake targets receive both orcka and compose tags
2. Images are tagged with both tags after build
3. Compose files can start services using either tag
4. Display shows both tag types
5. All tests passing (unit + contract)
6. Zero breaking changes to existing workflows
7. Documentation updated

## Documentation Updates Needed

1. **README.md**: Add section on dual tagging
2. **AGENTS.md**: Add guidelines for compose tag handling
3. **Example app**: Update to demonstrate dual tagging
4. **CLI help text**: Mention automatic compose tag detection

---

## Next Steps

After review and approval:
1. Create feature branch: `feature/dual-tagging`
2. Implement Step 1 (compose tag resolution)
3. Run `task health`, fix any issues
4. Implement Step 2 (tag matching)
5. Run `task health`, fix any issues
6. Implement Step 3 (HCL generation)
7. Run `task health:all-checks`
8. Integration testing
9. Documentation updates
10. Merge to main

**Estimated Effort**: 6-8 hours of focused development + testing

