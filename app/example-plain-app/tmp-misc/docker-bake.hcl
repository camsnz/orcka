## ############################################################################
## Variables
variable "ECR_REGISTRY" {
  default = "registry.example.com/demo-platform"
}
## -----------------------------------------------------------------------------
variable "NODE_DOCKER_IMAGE" {
  default = "node:20.19.4-bookworm-slim"
}
variable "JDK_DOCKER_IMAGE" {
  default = "gradle:6.9.4-jdk11"
}
variable "PY_DOCKER_IMAGE" {
  default = "python:3.13.3-slim-bookworm"
}
variable "PNPM_VERSION" {
  default = "8.15.7"
}
## -----------------------------------------------------------------------------
variable "OVERRIDE_DOCKER_BUILD_ARGS_WITH_REGIONAL_VARS" {
  default = {}
}

## -----------------------------------------------------------------------------
## Base Image Variables

variable "DEFAULT_LOCAL_TAG" {
  # see docker-bake.regional.hcl for regional overrides
  description = "Local builds use tag:local, regional builds use tag:regional-local"
  default = "local"
}

variable "JDK_CI_DEPS_TAG" {       # <- can be overridden by orcka
  default = "${DEFAULT_LOCAL_TAG}" # <- can be overridden by regional-local
}

variable "NODE_PROD_BASE_TAG" {
  default = "${DEFAULT_LOCAL_TAG}"
}

variable "NODE_CI_APT_TAG" {
  default = "${DEFAULT_LOCAL_TAG}"
}

variable "NODE_CI_PNPM_TAG" {
  default = "${DEFAULT_LOCAL_TAG}"
}

variable "NODE_CI_APP_LIBS_TAG" {
  default = "${DEFAULT_LOCAL_TAG}"
}

variable "NODE_CI_APP_SRC_TAG" {
  default = "${DEFAULT_LOCAL_TAG}"
}

## -----------------------------------------------------------------------------
## Test / Fake / Mock Variables
variable "STUB_APIS_TAG" {
  default = "${DEFAULT_LOCAL_TAG}"
}

variable "E2E_TESTS_TAG" {
  default = "${DEFAULT_LOCAL_TAG}"
}

variable "BLACKDUCK_TAG" {
  default = "${DEFAULT_LOCAL_TAG}"
}

variable "TAX_ORCHESTRATOR_TAG" {
  default = "${DEFAULT_LOCAL_TAG}"
}

## -----------------------------------------------------------------------------
## App Image Variables

variable "CONVERTER_SERVICE_TAG" {
  default = "${DEFAULT_LOCAL_TAG}"
}

variable "LEDGER_PORTAL_TAG" {
  default = "${DEFAULT_LOCAL_TAG}"
}

variable "AUDIT_ENGINE_TAG" {
  default = "${DEFAULT_LOCAL_TAG}"
}

variable "INVOICE_API_TAG" {
  default = "${DEFAULT_LOCAL_TAG}"
}

variable "RECONCILIATION_POLLERS_TAG" {
  default = "${DEFAULT_LOCAL_TAG}"
}

variable "COMPLIANCE_SERVICES_TAG" {
  default = "${DEFAULT_LOCAL_TAG}"
}

## -----------------------------------------------------------------------------
## Build Target Variables
variable "BAKE_BUILD_TARGET" {
  default = "ci_app_build_image"
  local = "ci_app_build_image" # local builds this
  ci = "prod_app_build_image" # the CI builds this (local + prod images)
}

## ############################################################################
## Groups

group "base-images" {
  targets = ["node-ci-app-src", "jdk-ci-deps"]
}


group "fake-images" {
  targets = ["stub-apis"]
}

group "finance-service-images" {
  targets = ["tax-orchestrator", "audit-engine", "invoice-api", "compliance-services", "reconciliation-pollers"]
}

group "all-images" {
  targets = ["fake-images", "finance-service-images", "ledger-portal"]
}

group "default" {
  targets = ["all-images"]
}

// group "production" {
//   targets = ["finance-service-targets", "ledger-portal"]
// }

## ############################################################################
## Base Images ################################################################
target "_use-local-cache" {
  cache-from = [
    "type=local,src=tmp/docker-buildx-cache"
  ]
  cache-to = [
    "type=local,dest=tmp/docker-buildx-cache,mode=max"
  ]
  depends_on = ["local-cache"]
}


target "node-prod-base" {
  dockerfile = "ci/docker/Dockerfile.node-prod-base"
  contexts = {
    node_reference_image = "docker-image://${NODE_DOCKER_IMAGE}"
  }
  inherits = [ "_use-local-cache" ]
  args = merge({
    PNPM_VERSION = PNPM_VERSION
  }, OVERRIDE_DOCKER_BUILD_ARGS_WITH_REGIONAL_VARS) # Regional overrides e.g. proxy or repo overrides
  target = "node_prod_base_image"
  tags = [
    "${ECR_REGISTRY}/node-prod-base:${NODE_PROD_BASE_TAG}",
  ]
}

target "node-ci-apt" {
  dockerfile = "ci/docker/Dockerfile.node-ci-apt"
  contexts = {
    node_prod_base_image = "target:node-prod-base"
  }
  target = "node_ci_apt_image"
  tags = ["${ECR_REGISTRY}/demo-platform/node-ci-apt:${NODE_CI_APT_TAG}"]
  depends_on = ["node-prod-base"]
}

target "node-ci-pnpm" {
  dockerfile = "ci/docker/Dockerfile.node-ci-pnpm"
  contexts = {
    node_ci_apt_image = "target:node-ci-apt"
  }
  target = "node_ci_pnpm_image"
  tags = ["${ECR_REGISTRY}/demo-platform/node-ci-pnpm:${NODE_CI_PNPM_TAG}"]
  depends_on = ["node-ci-apt"]
}

target "node-ci-app-libs" {
  dockerfile = "ci/docker/Dockerfile.node-ci-app-libs"
  contexts = {
    node_ci_pnpm_image = "target:node-ci-pnpm"
  }
  target = "node_app_libs"
  tags = ["${ECR_REGISTRY}/demo-platform/node-ci-app-libs:${NODE_CI_APP_LIBS_TAG}"]
  depends_on = ["node-ci-pnpm"]
}

target "node-ci-app-src" {
  dockerfile = "ci/docker/Dockerfile.node-ci-app-src"
  contexts = {
    node_ci_app_libs_image = "target:node-ci-app-libs"
  }
  target = "node_ci_app_src_image"
  tags = ["${ECR_REGISTRY}/demo-platform/node-ci-app-src:${NODE_CI_APP_SRC_TAG}"]
  depends_on = ["node-ci-app-libs"]
}

## ----------------------------------------------------------------------------
## JDK GRADLE BASE IMAGE (this could be a node image with a JDK GRADLE LAYER)
target "jdk-ci-deps" {
  dockerfile = "ci/docker/Dockerfile.jdk-ci-deps"
  inherits = [ "_use-local-cache" ]
  args = merge({
    PNPM_VERSION = PNPM_VERSION
  }, OVERRIDE_DOCKER_BUILD_ARGS_WITH_REGIONAL_VARS) # Regional overrides e.g. proxy or repo overrides
  target = "jdk_ci_deps_image"
  tags = ["${ECR_REGISTRY}/demo-platform/jdk-ci-deps:${JDK_CI_DEPS_TAG}"]
}

## ############################################################################
## Reusable Image Targets and Test Targets ####################################

target "_node-app-base" {
  dockerfile = "ci/docker/Dockerfile.node-ci-app-builder"
  contexts = {
    node_ci_app_src_image = "target:node-ci-app-src"
    node_prod_base_image = "target:node-prod-base"
  }
  target = "${BAKE_BUILD_TARGET}" # ci_app_build_image | prod_app_build_image
  depends_on = ["node-ci-app-src", "node-prod-base"]
}

## ----------------------------------------------------------------------------
target "stub-apis" {
  dockerfile = "apps/stub-apis/Dockerfile.stub-apis.bake"
  contexts = {
    node_ci_app_src_image = "target:node-ci-app-src"
  }
  target = "stub_apis_image"
  tags = ["${ECR_REGISTRY}/demo-platform/stub-apis:${STUB_APIS_TAG}"]
}

target "e2e-tests" {
  inherits = ["_node-app-base"]
  args = {
    NODE_APP_NAME = "e2e-tests"
  }
  target = "ci_app_build_image"
  tags = ["${ECR_REGISTRY}/demo-platform/e2e-tests:${E2E_TESTS_TAG}"]
}

target "blackduck" {
  dockerfile = "deployment/scans/blackduck/Dockerfile"
  // contexts = {
  //   node_ci_app_src_image = "target:node-ci-app-src"
  //   node_prod_base_image = "target:node-prod-base"
  // }
  // target = "blackduck_image"
  // depends_on = ["node-ci-app-src", "node-prod-base"]
  tags = ["${ECR_REGISTRY}/demo-platform/blackduck:${BLACKDUCK_TAG}"]
}

## ############################################################################
## Q Apps Etc #################################################################
target "faker" {
  dockerfile = "faker/Dockerfile"
  context = "../examples"
  tags = ["${ECR_REGISTRY}/demo-app/faker:${CONVERTER_SERVICE_TAG}"]
}

target "converter-service" {
  dockerfile = "converter/Dockerfile"
  context = "../examples"
  target = "prod"
  depends_on = ["jdk-ci-deps"]
  tags = ["${ECR_REGISTRY}/demo-app/converter-service:${CONVERTER_SERVICE_TAG}"]
}

## ############################################################################
## Core Apps ##################################################################
# ----------------------------------------------------------------------------
# DSL (jdk)
target "tax-orchestrator" {
  dockerfile = "apps/tax-orchestrator/Dockerfile.bake"
  contexts = {
    jdk_ci_pnpm_image = "target:jdk-ci-deps"
  }
  target = "production"
  depends_on = ["jdk-ci-deps"]
  tags = ["${ECR_REGISTRY}/demo-platform/tax-orchestrator:${TAX_ORCHESTRATOR_TAG}"]
}

## ----------------------------------------------------------------------------
## Conductor
target "ledger-portal" {
  inherits = ["_node-app-base"]
  args = {
    NODE_APP_NAME = "ledger-portal"
  }
  tags = ["${ECR_REGISTRY}/demo-platform/ledger-portal:${LEDGER_PORTAL_TAG}"]
}

## ----------------------------------------------------------------------------
## CORE Services

target "audit-engine" {
  inherits = ["_node-app-base"]
  args = {
    NODE_APP_NAME = "audit-engine"
  }
  tags = ["${ECR_REGISTRY}/demo-platform/audit-engine:${AUDIT_ENGINE_TAG}"]
}

target "invoice-api" {
  inherits = ["_node-app-base"]
  args = {
    NODE_APP_NAME = "invoice-api"
  }
  tags = ["${ECR_REGISTRY}/demo-platform/invoice-api:${INVOICE_API_TAG}"]
}

target "compliance-services" {
  inherits = ["_node-app-base"]
  args = {
    NODE_APP_NAME = "compliance-services"
  }
  tags = ["${ECR_REGISTRY}/demo-platform/compliance-services:${COMPLIANCE_SERVICES_TAG}"]
}

target "reconciliation-pollers" {
  inherits = ["_node-app-base"]
  args = {
    NODE_APP_NAME = "reconciliation-pollers"
  }
  tags = ["${ECR_REGISTRY}/demo-platform/reconciliation-pollers:${RECONCILIATION_POLLERS_TAG}"]
}

## ----------------------------------------------------------------------------
