variable "DEFAULT_LOCAL_TAG_VER" {
  default = "local"
}

variable "LEDGER_PORTAL_TAG_VER" {
  default = "${DEFAULT_LOCAL_TAG_VER}"
}

variable "AUDIT_ENGINE_TAG_VER" {
  default = "${DEFAULT_LOCAL_TAG_VER}"
}

variable "INVOICE_API_TAG_VER" {
  default = "${DEFAULT_LOCAL_TAG_VER}"
}


target "ledger-portal" {
  context = "./typescript-react-web"
  dockerfile = "Dockerfile"
  tags = ["ledger-portal:${LEDGER_PORTAL_TAG_VER}"]
}

target "audit-engine" {
  context = "./java-gradle-api"
  dockerfile = "Dockerfile"
  tags = ["audit-engine:${AUDIT_ENGINE_TAG_VER}"]
}

target "invoice-api" {
  context = "./python-fast-api"
  dockerfile = "Dockerfile"
  tags = ["invoice-api:${INVOICE_API_TAG_VER}"]
}

group "demo" {
  targets = ["ledger-portal", "audit-engine", "invoice-api"]
}

group "default" {
  targets = ["ledger-portal", "audit-engine", "invoice-api"]
}
