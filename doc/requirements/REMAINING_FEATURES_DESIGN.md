# Remaining Features Design - TARGET_STATE.md

This document outlines the design for the remaining requirements from TARGET_STATE.md after dual tagging implementation.

## Completed

✅ **Status Table Refactor** (Requirement #3)
- Changed from "Runtime Local Server" → "Container Local Remote" (CLR)
- Implementation: `src/cli/commands/shared.ts:177`
- Status: Complete, tested, all health checks passing

## In Progress

🔄 **Dual Tagging** (Requirements #1-2)
- Status: Design complete
- Document: `DUAL_TAGGING_DESIGN.md` (488 lines)
- Next: Implementation following 4-step plan
- Estimated effort: 6-8 hours

## Pending Features

### Feature 1: Registry List & Analysis (Requirements #4-5)

**Goal**: Collect and display registry information for all images

**Design Overview**:
```typescript
interface RegistryInfo {
  registryUrl: string;
  images: string[];
  localCount: number;
  totalCount: number;
  localSizeGB?: number;    // Optional: may not always be available
  totalSizeGB?: number;    // Optional: requires registry API access
}

interface RegistryListResult {
  registries: RegistryInfo[];
  warnings: string[];
}
```

**Implementation Plan**:
1. **Extract Registries** from all image references
   - Parse image references: `registry.example.com/namespace/image:tag`
   - Group by registry URL
   - Handle default registry (Docker Hub)
   
2. **Local Image Counting**
   - Use `docker images --format json` to get local images
   - Match against registry URLs
   - Count local vs total per registry

3. **Size Calculation** (Optional - Phase 2)
   - Local sizes: `docker images --format "{{.Size}}"` (easy)
   - Remote sizes: Requires registry API authentication (complex)
   - Initial implementation: Local sizes only

**Files to Create**:
- `src/docker/registry/registry-analyzer.ts`
- `src/docker/registry/registry-analyzer.spec.ts`

**Files to Modify**:
- Build plan display to include registry section
- `src/cli/commands/build-command.ts` to show registry info

**Complexity**: Medium-High
- Local counting: Easy
- Remote API access: Hard (auth, different registry types)

**Recommendation**: 
- Phase 1: Local counts only
- Phase 2: Remote API integration (optional)

---

### Feature 2: Run Command with Smart Build (Requirement #7)

**Goal**: New `orcka run` command that auto-builds missing images

**Current State**:
- `orcka up`: Starts services (assumes images exist)
- `orcka build`: Builds images
- `orcka workflow`: Builds then starts

**New Behavior**:
```bash
orcka run [services...]
```

**Flow**:
1. Run stat calculation
2. Check which images are missing locally
3. If any missing: Auto-run `docker buildx bake` for those targets
4. Start services with `docker compose up`

**Design**:
```typescript
// src/cli/commands/run-command.ts
export async function handleRunCommand(argv: string[]): Promise<void> {
  // Parse args (similar to up command)
  const { parsed, positionals } = parseWithPositionals(argv, RunCommandConfig);
  
  // Run stat
  const statResult = await runStatCalculation({ ... });
  
  // Assess build status
  const buildAssessment = assessBuildStatus(statResult);
  
  if (buildAssessment.missingImages.length > 0) {
    logger.info(`Missing ${buildAssessment.missingImages.length} images, building...`);
    
    // Auto-bake missing targets
    await executeBake({
      configFile: resolved.path,
      targets: buildAssessment.targetsTouild,
      // ...
    });
  }
  
  // Continue with compose up
  await runComposeUp({ ... });
}

interface BuildAssessment {
  missingImages: string[];
  targetsTo Build: string[];
  localImages: string[];
}

function assessBuildStatus(statResult: CalculateDockerShaResult): BuildAssessment {
  const availability = checkImageAvailability(
    statResult.generatedServices.map(s => s.imageReference)
  );
  
  const missing = availability
    .filter(a => !a.local)
    .map(a => a.image);
    
  const targetsTouild = statResult.generatedServices
    .filter(s => missing.includes(s.imageReference))
    .map(s => s.name);
    
  return { missingImages: missing, targetsToBuild, localImages: [] };
}
```

**Files to Create**:
- `src/cli/commands/run-command.ts`
- `src/cli/commands/run-command.spec.ts`
- `src/cli/parsers/command-configs.ts` (add RunCommandConfig)

**Files to Modify**:
- `src/orcka.ts` - Add 'run' to command router
- `src/cli/handlers/command-handlers.ts` - Add RUN_HELP_TEXT

**Complexity**: Medium
- Reuses existing primitives (stat, bake, up)
- Main logic: Build assessment and conditional bake

**Testing**:
- Unit tests for build assessment logic
- Contract tests for full run flow
- Manual testing with missing images

---

### Feature 3: Run Plan Display (Requirement #8)

**Goal**: Show what will be started before actually starting

**Design**:
```typescript
interface RunPlan {
  services: ComposeService[];
  networks: string[];
  volumes: string[];
}

interface ComposeService {
  name: string;
  image: string;
  dependsOn: string[];
  ports: string[];
}

function generateRunPlan(
  composeFiles: string[],
  serviceFilter?: string[]
): RunPlan {
  // Parse compose files
  // Extract services, networks, volumes
  // Filter by serviceFilter if provided
  // Return plan
}

function displayRunPlan(plan: RunPlan): void {
  console.log("\n" + Clout.heading("Run Plan", 2));
  
  console.log("\n📦 Services:");
  for (const service of plan.services) {
    console.log(Clout.bullet(`${service.name} (${service.image})`));
    if (service.dependsOn.length > 0) {
      console.log(Clout.dash(`depends on: ${service.dependsOn.join(", ")}`));
    }
  }
  
  if (plan.networks.length > 0) {
    console.log("\n🌐 Networks:");
    plan.networks.forEach(n => console.log(Clout.bullet(n)));
  }
  
  if (plan.volumes.length > 0) {
    console.log("\n💾 Volumes:");
    plan.volumes.forEach(v => console.log(Clout.bullet(v)));
  }
}
```

**Files to Create**:
- `src/docker/compose/compose-plan-generator.ts`
- `src/docker/compose/compose-plan-generator.spec.ts`

**Integration**:
- Call in `run` command before compose up
- Optional flag: `--dry-run` to show plan without starting

**Complexity**: Low-Medium
- Compose parsing: Already have infrastructure
- Display: Use existing Clout utilities

---

### Feature 4: Running Container Detection (Requirement #9)

**Goal**: Show which services are already running vs will be started

**Design**:
```typescript
interface ServiceRuntimeStatus {
  serviceName: string;
  containerName?: string;
  containerId?: string;
  status: 'not-running' | 'running' | 'exited' | 'paused';
  image: string;
  uptime?: string;
}

function checkRunningServices(
  services: string[]
): ServiceRuntimeStatus[] {
  // Use `docker ps --format json` to get running containers
  // Match containers to services by:
  //   1. Container name (service name from compose)
  //   2. Labels (com.docker.compose.service)
  //   3. Image name
  // Return status for each service
}

function displayServiceStatus(statuses: ServiceRuntimeStatus[]): void {
  console.log("\n" + Clout.heading("Service Status", 2));
  
  const headers = ["Service", "Container", "Status", "Image"];
  const rows = statuses.map(s => [
    s.serviceName,
    s.containerName || "n/a",
    formatStatus(s.status),
    s.image,
  ]);
  
  console.log(Clout.table(headers, rows, {
    columnWidths: [20, 20, 15, 35],
    border: false,
  }));
}

function formatStatus(status: string): string {
  const icons = {
    'running': `${Clout.symbols.checkmark} Running`,
    'exited': `${Clout.symbols.cross} Exited`,
    'paused': `${Clout.symbols.pause} Paused`,
    'not-running': "Not started",
  };
  return icons[status] || status;
}
```

**Key Distinction**:
- **Image**: Built artifact (shows in `docker images`)
- **Container**: Running instance (shows in `docker ps`)
- Display clarifies: "Image exists locally" vs "Container is running"

**Files to Create**:
- `src/docker/compose/service-status-checker.ts`
- `src/docker/compose/service-status-checker.spec.ts`

**Integration**:
- Call in `run` command before displaying run plan
- Show which services need to be started vs already running
- Option to restart running services: `--force-recreate`

**Complexity**: Medium
- Docker CLI parsing: Straightforward
- Matching logic: Need careful handling of edge cases
- Display: Existing Clout utilities make this easy

---

## Implementation Priority

### Recommended Order:
1. ✅ **Status Table Refactor** (Complete)
2. 🔄 **Dual Tagging** (In progress - design complete)
3. 🟡 **Run Command** (High value, moderate complexity)
4. 🟡 **Run Plan Display** (Complements run command)
5. 🟡 **Running Container Detection** (Enhances run command)
6. 🔴 **Registry List** (Lower priority, high complexity for full feature)

### Rationale:
- Run command trio (3-5) can be implemented together as they're closely related
- Registry list is standalone and can be done later
- Each feature adds immediate user value

---

## Testing Strategy

### For Each Feature:

**Unit Tests**:
- Core logic functions
- Edge case handling
- Error scenarios

**Contract Tests**:
- Full command execution
- Integration with existing features
- Verify CLI output format

**Manual Testing**:
```bash
# In example-plain-app
cd app/example-plain-app

# Test run command
orcka run

# Test with missing images
docker rmi python-fast-api:latest
orcka run  # Should auto-build

# Test status detection
docker compose up -d web
orcka run  # Should show web as already running

# Test run plan
orcka run --dry-run  # Show plan without starting
```

---

## Open Questions

1. **Run vs Up vs Workflow**: Should `orcka run` replace `orcka up` or coexist?
   - **Recommendation**: Coexist. `up` = start only, `run` = smart start with auto-build

2. **Force Rebuild**: Should `run` support `--rebuild` to force bake even if images exist?
   - **Recommendation**: Yes, add `--rebuild` flag

3. **Partial Runs**: What if some services are running but wrong version?
   - **Recommendation**: Check image SHA, recreate if mismatch

4. **Non-Compose Projects**: What if no compose files exist?
   - **Recommendation**: `run` command requires compose files, show helpful error

---

## Success Metrics

### Feature Complete When:
- ✅ All unit tests passing
- ✅ All contract tests passing  
- ✅ `task health:all-checks` passing
- ✅ Manual testing successful
- ✅ Documentation updated
- ✅ Zero breaking changes

### Quality Gates:
- Code coverage: Maintain 80%+
- File size: Keep under 350 LoC per file
- Linting: Zero warnings/errors
- Build: Clean compilation

---

## Effort Estimates

| Feature | Complexity | Estimated Hours |
|---------|-----------|-----------------|
| Dual Tagging (design done) | High | 6-8 |
| Run Command | Medium | 3-4 |
| Run Plan Display | Low-Medium | 2-3 |
| Running Container Detection | Medium | 2-3 |
| Registry List (basic) | Medium | 3-4 |
| Registry List (full) | High | 8-10 |

**Total for MVP** (excluding full registry): 16-22 hours
**Total with full registry**: 24-32 hours

---

## Next Actions

1. **Review dual tagging design** (`DUAL_TAGGING_DESIGN.md`)
2. **Approve/modify approach**
3. **Begin implementation** of dual tagging (Step 1)
4. **Iterate** with `task health` after each step
5. **Move to next feature** after dual tagging complete

Would you like to:
- Proceed with dual tagging implementation?
- Modify any of these designs?
- Discuss specific technical approaches?

