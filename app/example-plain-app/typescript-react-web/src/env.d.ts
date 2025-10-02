/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AUDIT_ENGINE_URL?: string
  readonly VITE_INVOICE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
