## ############################################################################
## Regional overrides – example values that differ from the default bake file
variable "DEFAULT_LOCAL_TAG" {
  default = "regional-local"
}

variable "OVERRIDE_DOCKER_BUILD_ARGS_WITH_REGIONAL_VARS" {
  default = {
    HTTPS_PROXY = "http://proxy.internal.example:3128"
    HTTP_PROXY = "http://proxy.internal.example:3128"
    NPM_REGISTRY = "https://packages.internal.example/api/npm/internal"
    DEBIAN_REPO = "https://packages.internal.example/debian-stable"
    MAVEN_URL_OVERRIDE = "https://packages.internal.example/maven-central"
    MAVEN_PLUGINS_URL_OVERRIDE = "https://packages.internal.example/maven-plugins"
    GRADLE_DISTRIBUTION_URL_OVERRIDE = "https://packages.internal.example/gradle/gradle-8.0-all.zip"
    PIP_PACKAGE_REPO = "https://packages.internal.example/api/pypi/simple"
  }
}
