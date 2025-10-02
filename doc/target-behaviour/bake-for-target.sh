#!/usr/bin/env sh


GITDIR=$(git rev-parse --show-toplevel)

usage() {
  echo "Usage: $0 [--env <environment>] [--target <target>] [--options <buildx options>] [--defaults]"
  echo ""
  echo "Options:"
  echo "  --env <ci|local>          Set the environment (default: ci)"
  echo "  --target <target>         Set the build target (default: default)"
  echo "  --options <for buildx>    buildx options e.g. --file, --network, regional settings"
  echo "  --defaults                Use default settings (env=ci, target=default)"
  echo "  --raw                     Minimal output"
  echo "  --help, -h, --usage       Show this help message"
}

# Print usage if no parameters are provided
if [ $# -eq 0 ]; then
  usage
  exit 0
fi

TARGET="default"
ENV="ci"

while [ $# -gt 0 ]; do
  case "$1" in
    --defaults)
      TARGET="default"
      ENV="ci"
      shift
      ;;
    --env)
      ENV="$2"
      shift 2
      ;;
    --options)
      OPTIONS="$2"
      shift 2
      ;;
    --options=*)
      OPTIONS="${1#--options=}"
      shift
      ;;
    --target)
      TARGET="$2"
      shift 2
      ;;
    --raw)
      RAW=true
      shift
      ;;
    --help|-h|--usage)
      usage
      exit 0
      ;;
    *)
      break
      ;;
  esac
done

if [ $ENV == "local" ]; then
  BAKE_BUILD_TARGET="ci_app_image"
else
  BAKE_BUILD_TARGET="prod_app_image"
fi

print() {
  if [ "$RAW" != true ]; then
    echo "$@"
  fi
}

CACHE_DIR="${GITDIR}/tmp/docker-buildx-cache"
if [ ! -d "${CACHE_DIR}" ]; then
  print "Creating cache directory at ${CACHE_DIR}"
  mkdir -p ${CACHE_DIR}
fi

print "#> Docker Build Bake 🐳🥧"
print "#> target=${TARGET}, env=${ENV}, BAKE_BUILD_TARGET=${BAKE_BUILD_TARGET}"
print ""

export BAKE_BUILD_TARGET=${BAKE_BUILD_TARGET}

docker buildx bake --file ${GITDIR}/docker-bake.hcl \
                   --file ${GITDIR}/docker-compose.yml \
                   --progress auto \
                   ${OPTIONS} ${TARGET}
