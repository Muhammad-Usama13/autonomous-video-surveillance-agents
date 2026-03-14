import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../utils/api'
import { Panel, SectionHeader, EmptyState, Spinner } from '../components/UI'
import IncidentCard from '../components/IncidentCard'

const SEVERITIES = ['all', 'critical', 'high', 'medium', 'low']

export default function Incidents() {
  const [params] = useSearchParams()
  const sessionFilter = params.get('session')

  const [incidents, setIncidents] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [severity,  setSeverity]  = useState('all')
  const [search,    setSearch]    = useState('')

  useEffect(() => {
    const sev = severity === 'all' ? undefined : severity
    api.getIncidents(sessionFilter, sev)
      .then(i => { setIncidents(i); setLoading(false) })
  }, [sessionFilter, severity])

  const filtered = incidents.filter(inc =>
    !search ||
    inc.event_type?.includes(search) ||
    inc.description?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="flex h-full flex-col gap-5 overflow-auto p-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-3xl tracking-[0.15em] text-[var(--accent)]">INCIDENTS</h1>
        <p className="font-mono text-[11px] text-[var(--muted)] mt-1">
          {sessionFilter ? `SESSION: ${sessionFilter.slice(0, 8)}…` : 'ALL SESSIONS'} · {filtered.length} RECORDS
        </p>
      </div>

      {/* Filters */}
      <Panel className="flex flex-wrap items-center gap-4">
        {/* Severity filter */}
        <div className="flex gap-2 flex-wrap">
          {SEVERITIES.map(sev => (
            <button
              key={sev}
              onClick={() => setSeverity(sev)}
              className={`font-mono text-[10px] uppercase tracking-widest rounded px-3 py-1.5 border transition-all ${
                severity === sev
                  ? 'border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/10'
                  : 'border-[#1a2236] text-[var(--muted)] hover:border-[var(--accent)]/40'
              }`}
            >
              {sev}
            </button>
          ))}
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="Search events or descriptions…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="ml-auto rounded border border-[#1a2236] bg-[#0a0d12] px-3 py-1.5 font-mono text-xs text-slate-300 placeholder:text-[var(--muted)] focus:border-[var(--accent)] outline-none transition-colors w-60"
        />
      </Panel>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16"><Spinner size={32} /></div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="🔍"
          title="No incidents found"
          sub={severity !== 'all' ? `No ${severity} severity incidents` : 'Upload a video to begin detection'}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(inc => (
            <IncidentCard key={inc.id} incident={inc} />
          ))}
        </div>
      )}
    </div>
  )
}
