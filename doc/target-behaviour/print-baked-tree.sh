#!/usr/bin/env sh

GITDIR=$(git rev-parse --show-toplevel)

# Default file paths
BAKE_FILE="${GITDIR}/docker-bake.hcl"
COMPOSE_FILE="${GITDIR}/docker-compose.yml"
BUILD_ENV="ci"
SHOW_HELP=false

# Parse command line arguments
while [ $# -gt 0 ]; do
  case $1 in
    --bake-file)
      BAKE_FILE="$2"
      shift 2
      ;;
    --compose-file)
      COMPOSE_FILE="$2"
      shift 2
      ;;
    --file)
      # Support both bake and compose files with single --file flag
      if [ -z "$2" ]; then
        echo "❌ --file requires a file path"
        exit 1
      fi
      # If it's a .hcl file, treat as bake file
      if echo "$2" | grep -q '\.hcl$'; then
        BAKE_FILE="$2"
      # If it's a .yml or .yaml file, treat as compose file
      elif echo "$2" | grep -q '\.ya\?ml$'; then
        COMPOSE_FILE="$2"
      else
        echo "❌ Unsupported file type: $2 (expected .hcl, .yml, or .yaml)"
        exit 1
      fi
      shift 2
      ;;
    --help|-h)
      SHOW_HELP=true
      shift
      ;;
    -*)
      echo "❌ Unknown option: $1"
      echo "Use --help for usage information"
      exit 1
      ;;
    *)
      BUILD_ENV="$1"
      shift
      ;;
  esac
done

# Show help if requested
if [ "$SHOW_HELP" = true ]; then
  cat << EOF
Usage: $0 [OPTIONS] [BUILD_ENV]

Show Docker build target hierarchy from bake and compose files.

OPTIONS:
  --bake-file FILE      Specify docker-bake.hcl file (default: ./docker-bake.hcl)
  --compose-file FILE   Specify docker-compose.yml file (default: ./docker-compose.yml)
  --file FILE           Specify either bake (.hcl) or compose (.yml/.yaml) file
  --help, -h            Show this help message

ARGUMENTS:
  BUILD_ENV            Build environment (default: ci)

EXAMPLES:
  $0                                    # Use default files
  $0 --bake-file custom.hcl            # Use custom bake file
  $0 --file docker-bake.hcl local      # Specify bake file and environment
  $0 --file docker-compose.yml         # Specify compose file

EOF
  exit 0
fi

# Validate files exist
if [ ! -f "$BAKE_FILE" ]; then
  echo "❌ Bake file not found: $BAKE_FILE"
  exit 1
fi

if [ ! -f "$COMPOSE_FILE" ]; then
  echo "❌ Compose file not found: $COMPOSE_FILE"
  exit 1
fi

# Export docker buildx bake configuration as JSON
echo "#> Docker Build Bake Tree 🐳🥧🌳"
echo "📁 Bake file: $BAKE_FILE"
echo "📁 Compose file: $COMPOSE_FILE"
echo "🏗️  Environment: $BUILD_ENV"
echo ""

BAKE_JSON=$(docker buildx bake --file "$BAKE_FILE" \
                               --file "$COMPOSE_FILE" \
                               ${BUILD_OPTIONAL} \
                               --print \
                               default 2>/dev/null)

if [ $? -ne 0 ] || [ -z "$BAKE_JSON" ]; then
  echo "❌ Failed to export bake configuration as JSON"
  exit 1
fi

# Parse JSON and build dependency tree
parse_bake_tree() {
  echo "$BAKE_JSON" | jq -r '
    def build_tree(targets; visited; prefix; is_last):
      targets as $targets |
      ($targets | keys | sort) as $sorted_keys |
      $sorted_keys[] as $target |
      if ($visited | index($target) | not) then
        ($visited + [$target]) as $new_visited |
        if is_last and ($target == $sorted_keys[-1]) then
          (prefix + "└── " + $target)
        else
          (prefix + "├── " + $target)
        end,
        (
          if ($targets[$target].depends_on // [] | length > 0) then
            ($targets[$target].depends_on // []) as $deps |
            ($deps | map(select(. as $dep | $targets | has($dep))) | sort) as $valid_deps |
            if ($valid_deps | length > 0) then
              if is_last and ($target == $sorted_keys[-1]) then
                build_tree($targets | with_entries(select(.key as $k | $valid_deps | index($k))); $new_visited; prefix + "    "; false)
              else
                build_tree($targets | with_entries(select(.key as $k | $valid_deps | index($k))); $new_visited; prefix + "│   "; false)
              end
            else empty
            end
          else empty
          end
        )
      else empty
      end;
    
    .target as $targets |
    
    # Find root targets (those not depended on by others)
    ($targets | keys) as $all_targets |
    ($targets | to_entries | map(.value.depends_on // []) | flatten | unique) as $depended_targets |
    ($all_targets - $depended_targets) as $root_targets |
    
    "Docker Build Target Hierarchy:",
    "",
    if ($root_targets | length > 0) then
      build_tree($targets | with_entries(select(.key as $k | $root_targets | index($k))); []; ""; true)
    else
      "No root targets found - showing all targets:",
      build_tree($targets; []; ""; true)
    end
  ' 2>/dev/null
}

# Enhanced tree parser with pattern-first deduplication
parse_enhanced_tree() {
  echo "$BAKE_JSON" | jq -r '
    .target as $targets |
    
    # Extract dependencies from contexts (target:name format) and inherits
    def get_dependencies($target_name):
      ($targets[$target_name].contexts // {} | to_entries | 
       map(select(.value | startswith("target:")) | .value | ltrimstr("target:"))) +
      ($targets[$target_name].inherits // []) |
      map(select(. as $dep | $targets | has($dep))) | unique;
    
    # Generate a signature for a subtree to detect duplicates
    def subtree_signature($target; $visited):
      if ($visited | index($target) | not) then
        ($visited + [$target]) as $new_visited |
        get_dependencies($target) as $deps |
        if ($deps | length > 0) then
          $target + "[" + ([$deps[] | subtree_signature(.; $new_visited)] | sort | join(",")) + "]"
        else
          $target
        end
      else
        $target + "(cycle)"
      end;
    
    # Build a simple tree without deduplication (for showing patterns)
    def print_simple_tree($target; $prefix; $is_last; $visited):
      if ($visited | index($target) | not) then
        ($visited + [$target]) as $new_visited |
        ($prefix + (if $is_last then "└── " else "├── " end) + $target),
        (get_dependencies($target) as $deps |
         if ($deps | length > 0) then
           ($deps | sort) as $sorted_deps |
           ($sorted_deps | to_entries[] |
            .key as $idx | .value as $dep |
            print_simple_tree($dep; 
                             $prefix + (if $is_last then "    " else "│   " end); 
                             ($idx == (($sorted_deps | length) - 1)); 
                             $new_visited)
           )
         else empty
         end)
      else 
        ($prefix + (if $is_last then "└── " else "├── " end) + $target + " (↻)")
      end;
    
    # Build tree with pattern references
    def print_tree_with_patterns($target; $prefix; $is_last; $visited; $pattern_targets):
      if ($visited | index($target) | not) then
        ($visited + [$target]) as $new_visited |
        ($prefix + (if $is_last then "└── " else "├── " end) + $target),
        (get_dependencies($target) as $deps |
         if ($deps | length > 0) then
           ($deps | sort) as $sorted_deps |
           ($sorted_deps | to_entries[] |
            .key as $idx | .value as $dep |
            if ($pattern_targets | index($dep)) then
              ($prefix + (if $is_last then "    " else "│   " end) + 
               (if ($idx == (($sorted_deps | length) - 1)) then "└── " else "├── " end) + 
               $dep),
              ($prefix + (if $is_last then "    " else "│   " end) + 
               (if ($idx == (($sorted_deps | length) - 1)) then "    " else "│   " end) + "└── ...")
            else
              print_tree_with_patterns($dep; 
                                     $prefix + (if $is_last then "    " else "│   " end); 
                                     ($idx == (($sorted_deps | length) - 1)); 
                                     $new_visited;
                                     $pattern_targets)
            end
           )
         else empty
         end)
      else 
        ($prefix + (if $is_last then "└── " else "├── " end) + $target + " (↻)")
      end;
    
    # Find all dependency relationships
    ($targets | keys) as $all_targets |
    ($targets | to_entries | map(.key as $k | .value as $v | 
      {target: $k, deps: get_dependencies($k), signature: subtree_signature($k; [])})) as $dep_map |
    
    # Find targets that are depended upon by others
    ($dep_map | map(.deps[]) | unique) as $depended_targets |
    ($all_targets - $depended_targets) as $true_roots |
    
    # Identify pattern targets (targets that are dependencies and have their own dependencies)
    ($dep_map | map(select(.deps | length > 0)) | 
     map(select(.target as $t | $depended_targets | index($t))) | 
     map(.target) | unique) as $pattern_targets |
    
    "",
    "🌳 Unique Dependency Trees:",
    "",
    
    # First show the unique patterns
    if ($pattern_targets | length > 0) then
      ($pattern_targets | sort | to_entries[] |
       .key as $idx | .value as $pattern |
       (if ($idx == 0) then "├── " else "|── " end) + $pattern,
       print_simple_tree($pattern; "    "; true; [])
      ),
      ""
    else empty
    end,
    
    # Then show the main targets with pattern references
    if ($true_roots | length > 0) then
      ($true_roots | sort | to_entries[] |
       .key as $idx | .value as $root |
       print_tree_with_patterns($root; ""; ($idx == (($true_roots | length) - 1)); []; $pattern_targets)
      )
    else
      "⚠️  No clear root targets found. Showing dependency relationships:",
      ($dep_map | map(select(.deps | length > 0)) | sort_by(.target)[] |
       .target + " → " + (.deps | join(", ")))
    end,
    "",
    "📊 Summary:",
    "Total targets: " + ($all_targets | length | tostring),
    "Root targets: " + ($true_roots | length | tostring),
    "Pattern targets: " + ($pattern_targets | length | tostring),
    "Targets with dependencies: " + ($dep_map | map(select(.deps | length > 0)) | length | tostring)
  ' 2>/dev/null
}

# Check if jq is available
if ! command -v jq >/dev/null 2>&1; then
  echo "❌ jq is required but not installed. Please install jq to parse JSON."
  echo "   On macOS: brew install jq"
  exit 1
fi

# Parse and display the tree
parse_enhanced_tree

echo ""
echo "💡 To build specific targets, use:"
echo "   docker buildx bake --file \"$BAKE_FILE\" --file \"$COMPOSE_FILE\" <target-name>"
