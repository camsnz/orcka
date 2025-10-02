#!/usr/bin/env sh

echo "#> Docker Build Bake 🐳🥧 :: 👀"
echo ""
docker buildx bake --file ${GITDIR}/docker-bake.hcl \
                   --file ${GITDIR}/docker-compose.yml \
                   --progress auto \
                   ${BUILD_OPTIONAL} ${TARGET}

GITDIR=$(git rev-parse --show-toplevel)

echo "#> Docker Build Bake 🐳🥧 :: 👀"
echo ""

FILE="docker-bake.hcl"

# Get all available targets (groups and targets) from docker-bake.hcl
AVAILABLE_TARGETS=$(docker buildx bake --file "$GITDIR/${FILE}" --print | jq -r '(.group // {} | to_entries[] | .key), (.target // {} | to_entries[] | .key)' | sort | uniq)

# Parse --target or -t argument if provided
USER_TARGET=""
for arg in "$@"; do
    case $arg in
        --target=*)
            USER_TARGET="${arg#*=}"
            ;;
        --target)
            shift
            USER_TARGET="$1"
            ;;
        -t=*)
            USER_TARGET="${arg#*=}"
            ;;
        -t)
            shift
            USER_TARGET="$1"
            ;;
    esac
done

if [ -n "$USER_TARGET" ]; then
    # Check if the user target is in the available targets
    if ! echo "$AVAILABLE_TARGETS" | grep -qx "$USER_TARGET"; then
        echo "\n[ERROR] Invalid target: '$USER_TARGET'"
        echo "Available targets are:"
        echo "$AVAILABLE_TARGETS" | sed 's/^/  - /'
        exit 1
    fi
fi

export BAKE_BUILD_TARGET=${BAKE_BUILD_TARGET}
docker buildx bake --file ${GITDIR}/docker-bake.hcl \
                                     --file ${GITDIR}/docker-compose.yml \
                                     --progress auto \
                                     "$@"
