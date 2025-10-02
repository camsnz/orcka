import { useMemo, useState } from 'react'
import './App.css'
import type { ServiceDescriptor, ServiceInfo, ServiceState } from './types'

const auditEndpoint =
  import.meta.env.VITE_AUDIT_ENGINE_URL ?? 'http://localhost:8080/info'
const invoiceEndpoint =
  import.meta.env.VITE_INVOICE_API_URL ?? 'http://localhost:8000/info'

const SERVICES: ServiceDescriptor[] = [
  {
    id: 'audit-engine',
    label: 'Audit Engine (Java)',
    description:
      'Shows compliance evidence gathered by the Java audit service.',
    infoUrl: auditEndpoint,
    accent: 'blue',
  },
  {
    id: 'invoice-api',
    label: 'Invoice API (Python)',
    description:
      'Returns billing metadata supplied by the Python FastAPI backend.',
    infoUrl: invoiceEndpoint,
    accent: 'purple',
  },
]

type StateMap = Record<ServiceDescriptor['id'], ServiceState>

const initialState: StateMap = SERVICES.reduce<StateMap>((acc, service) => {
  acc[service.id] = { status: 'idle' }
  return acc
}, {} as StateMap)

async function fetchServiceInfo(url: string): Promise<ServiceInfo> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Received ${response.status} from ${url}`)
  }
  return (await response.json()) as ServiceInfo
}

function App() {
  const [serviceState, setServiceState] = useState<StateMap>(initialState)

  const headers = useMemo(
    () => [
      { key: 'serviceName', label: 'Service' },
      { key: 'techStack', label: 'Stack' },
      { key: 'buildVersion', label: 'Version' },
      { key: 'buildTime', label: 'Build Time (UTC)' },
      { key: 'gitSha', label: 'Git SHA' },
    ] as const,
    [],
  )

  async function handleLoad(descriptor: ServiceDescriptor) {
    setServiceState((prev) => ({ ...prev, [descriptor.id]: { status: 'loading' } }))
    try {
      const payload = await fetchServiceInfo(descriptor.infoUrl)
      setServiceState((prev) => ({ ...prev, [descriptor.id]: { status: 'success', payload } }))
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to contact service'
      setServiceState((prev) => ({ ...prev, [descriptor.id]: { status: 'error', message } }))
    }
  }

  return (
    <div className="app-shell">
      <header className="hero">
        <div>
          <span className="eyebrow">orcka demo environment</span>
          <h1>Welcome to Orcka Launchpad</h1>
          <p>
            This sample workspace bundles a React front-end with Java and Python
            APIs. Use it to experiment with Orcka's deterministic tagging and
            build orchestration.
          </p>
        </div>
        <div className="hero-actions">
          <a
            className="button outline"
            href="https://github.com/camsnz/orcka"
            target="_blank"
            rel="noreferrer"
          >
            View Documentation
          </a>
          <a className="button" href="https://orcka.dev" target="_blank" rel="noreferrer">
            Learn More
          </a>
        </div>
      </header>

      <section className="services-grid">
        {SERVICES.map((service) => {
          const state = serviceState[service.id]
          return (
            <article key={service.id} className={`service-card accent-${service.accent}`}>
              <header>
                <h2>{service.label}</h2>
                <p>{service.description}</p>
              </header>

              <div className="service-content">
                {state.status === 'success' ? (
                  <>
                    <dl className="service-meta">
                      {headers.map(({ key, label }) => (
                        <div key={key}>
                          <dt>{label}</dt>
                          <dd>{state.payload[key]}</dd>
                        </div>
                      ))}
                    </dl>
                    <div className="dependencies">
                      <h3>Dependencies</h3>
                      <ul>
                        {state.payload.dependencies.map((entry) => (
                          <li key={`${service.id}-${entry.name}`}>
                            {entry.name} - {entry.version}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </>
                ) : state.status === 'loading' ? (
                  <p className="status loading">Requesting info...</p>
                ) : state.status === 'error' ? (
                  <p className="status error">{state.message}</p>
                ) : (
                  <p className="status idle">No data loaded yet.</p>
                )}
              </div>

              <footer>
                <button className="button block" onClick={() => handleLoad(service)}>
                  {state.status === 'loading' ? 'Loading...' : 'Fetch service info'}
                </button>
              </footer>
            </article>
          )
        })}
      </section>

      <footer className="app-footer">
        Built with love for deterministic Docker builds. Tag it with <code>orcka</code>.
      </footer>
    </div>
  )
}

export default App
