#!/usr/bin/env sh

GITDIR=$(git rev-parse --show-toplevel)

# Default file
FILE="docker-bake.hcl"

# Parse --file argument
while [ $# -gt 0 ]; do
	case $1 in
		--file)
			shift
			FILE="$1"
			;;
		--file=*)
			FILE="${1#*=}"
			;;
        --raw)
        RAW=true
        shift
        ;;
	esac
	shift
done

print() {
  if [ "$RAW" != true ]; then
    echo "$@"
  fi
}

JSON=$(docker buildx bake --file "$GITDIR/${FILE}" --print 2>/dev/null)

# Extract group names and target names from the JSON output
TARGET_NAMES=$(echo "$JSON" | jq -r '(.target // {} | to_entries[] | .key)' | sort | uniq)
GROUP_NAMES=$(echo "$JSON" | jq -r '(.group // {} | to_entries[] | .key)' | sort | uniq)
# TARGETS=$(echo "$JSON" | jq -r '(.targets // {} | to_entries[] | .key)' | sort | uniq)

if [ $RAW = true ]; then
    # Combined list of targets and groups
    ALL_TARGETS=$(echo "$GROUP_NAMES\n$TARGET_NAMES" | sort | uniq)
    echo "$ALL_TARGETS"
    exit 0
fi

print "#> Docker Build Bake 🐳🥧 :: Available targets in $FILE"
print "Groups:"
print "$GROUP_NAMES" | sed 's/^/  - /'
print "Targets:"
print "$TARGET_NAMES" | sed 's/^/  - /'
