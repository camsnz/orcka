export type DependencyInfo = {
  name: string
  version: string
}

export type ServiceInfo = {
  serviceName: string
  techStack: string
  buildTime: string
  gitSha: string
  buildVersion: string
  dependencies: DependencyInfo[]
}

export type ServiceDescriptor = {
  id: 'audit-engine' | 'invoice-api'
  label: string
  description: string
  infoUrl: string
  accent: 'blue' | 'purple'
}

export type ServiceState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; payload: ServiceInfo }

export type ServiceSuccessState = Extract<ServiceState, { status: 'success' }>
