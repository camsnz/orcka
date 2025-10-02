variable "TEST_TAG_VER" {
  default = ""
}

project {
  name = "priority-test-orcka-hcl"
  context = "."
  write = "docker-sha.hcl"
  bake = ["docker-bake.hcl"]
}

targets {
  test-service {
    calculate_on {
      always = true
    }
  }
}
