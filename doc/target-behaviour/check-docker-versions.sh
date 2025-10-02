#!/usr/bin/env sh

VERSIONS=$(docker version)
ERR=$?
if [ $ERR -ne 0 ]; then
    echo "Docker not running or not installed"
    exit 1
fi

# Sample `docker version` output:
# Client:
#  Version:           28.0.1
#  API version:       1.48
#  Go version:        go1.23.6
#  Git commit:        068a01e
#  Built:             Wed Feb 26 10:38:16 2025
#  OS/Arch:           darwin/arm64
#  Context:           desktop-linux

# Server: Docker Desktop 4.39.0 (184744)
#  Engine:
#   Version:          28.0.1
#   API version:      1.48 (minimum version 1.24)
#   Go version:       go1.23.6
#   Git commit:       bbd0a17
#   Built:            Wed Feb 26 10:40:57 2025
#   OS/Arch:          linux/arm64
#   Experimental:     false
#  containerd:
#   Version:          1.7.25
#   GitCommit:        bcc810d6b9066471b0b6fa75f557a15a1cbf31bb
#  runc:
#   Version:          1.2.4
#   GitCommit:        v1.2.4-0-g6c52b3f
#  docker-init:
#   Version:          0.19.0
#   GitCommit:        de40ad0

print_error() {
  if [ "$RAW" != true ]; then
    echo ""
    echo "Error: $@"
    echo ""
  fi
}

EXIT_CODE=0

has_docker_desktop_min_version() {
  MIN_DESKTOP_VERSION="4.38.0"
  DESKTOP_VERSION=$(echo "$VERSIONS" | grep "Server: Docker Desktop" | sed -E 's/.*Server: Docker Desktop ([0-9]+\.[0-9]+\.[0-9]+).*/\1/')
  
  if [ -z "$DESKTOP_VERSION" ]; then
    echo "Could not determine Docker Desktop version"
    EXIT_CODE=1
  fi
  
  if ! command -v semver &> /dev/null; then
    # Simple version comparison without semver tool
    if [ "$(printf '%s\n' "$MIN_DESKTOP_VERSION" "$DESKTOP_VERSION" | sort -V | head -n1)" != "$MIN_DESKTOP_VERSION" ]; then
      echo "Docker Desktop version $DESKTOP_VERSION is older than required minimum version $MIN_DESKTOP_VERSION"
      EXIT_CODE=1
    fi
  else
    # Use semver for more robust comparison if available
    if ! semver -r ">=$MIN_DESKTOP_VERSION" "$DESKTOP_VERSION" &> /dev/null; then
      echo "Docker Desktop version $DESKTOP_VERSION is older than required minimum version $MIN_DESKTOP_VERSION"
      EXIT_CODE=1
    fi
  fi
  
  echo "Docker Desktop version $DESKTOP_VERSION meets minimum requirement ($MIN_DESKTOP_VERSION)"
}

has_docker_bake() {
  # Verify buildx bake exists.
  BAKE_HELP=$(docker buildx bake --help 2>/dev/null)
  if echo "$BAKE_HELP" | grep -q "Usage:.*docker buildx bake"; then
    echo "Using Docker buildx bake..."
  else
    echo "Error: Docker buildx bake is not available"
    EXIT_CODE=1
  fi
}

has_containerd_running() {
  # Verify containerd is running.
  CONTAINERD_STATUS=$(docker buildx inspect 2>/dev/null | grep "containerd")
  if echo "$CONTAINERD_STATUS" | grep -q "driver-type\:.*containerd"; then
    echo "containerd is running..."
  else
    print_error "containerd is not running (docker buildx inspect | grep containerd)"

    echo """Containerd needs to be enabled manually in Docker Desktop:
  - Navigate to Settings in Docker Desktop.
  - In the General tab, check Use containerd for pulling and storing images.
  - Select Apply.
"""

    EXIT_CODE=1
  fi
}

# has_docker_desktop_min_version
has_docker_bake
has_containerd_running

exit ${EXIT_CODE}