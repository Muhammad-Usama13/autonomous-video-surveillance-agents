import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../utils/api'
import { Panel, SectionHeader, EmptyState, Spinner, Btn } from '../components/UI'
import IncidentCard from '../components/IncidentCard'
import MotionGuideModal from '../components/MotionGuideModal'

const SEVERITIES = ['all', 'critical', 'high', 'medium', 'low']

export default function Incidents() {
  const [params] = useSearchParams()
  const sessionFilter = params.get('session')

  const [incidents, setIncidents] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [severity,  setSeverity]  = useState('all')
  const [search,    setSearch]    = useState('')
  const [guideOpen, setGuideOpen] = useState(false)

  useEffect(() => {
    const sev = severity === 'all' ? undefined : severity
    api.getIncidents(sessionFilter, sev)
      .then(i => { setIncidents(i || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [sessionFilter, severity])

  const filtered = incidents.filter(inc =>
    !search ||
    inc.event_type?.toLowerCase().includes(search.toLowerCase()) ||
    inc.description?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-6 lg:p-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-[var(--text-primary)]">
            Incident Alert Log
          </h1>
          <p className="text-xs text-[var(--text-muted)] font-mono mt-1">
            {sessionFilter ? `FILTERED BY SESSION: ${sessionFilter.slice(0, 8)}…` : 'ALL DETECTED EVENTS'} · {filtered.length} INCIDENTS
          </p>
        </div>

        <button
          onClick={() => setGuideOpen(true)}
          className="flex items-center gap-1.5 rounded-xl border border-[var(--accent)]/30 bg-[var(--accent-light)] px-3.5 py-2 text-xs font-semibold text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white transition-all shadow-sm"
        >
          <span>💡</span>
          <span>Color & Motion Guide</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <Panel className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* Severity filter buttons */}
        <div className="flex gap-1.5 flex-wrap">
          {SEVERITIES.map(sev => (
            <button
              key={sev}
              onClick={() => setSeverity(sev)}
              className={`font-mono text-xs font-semibold uppercase tracking-wider rounded-xl px-3 py-1.5 border transition-all ${
                severity === sev
                  ? 'border-[var(--accent)] text-white bg-[var(--accent)] shadow-sm'
                  : 'border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--text-primary)] bg-[var(--bg-surface)]'
              }`}
            >
              {sev}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search incident descriptions…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full sm:w-72 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] outline-none transition-all shadow-sm"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              ✕
            </button>
          )}
        </div>
      </Panel>

      {/* Incident Grid */}
      {loading ? (
        <div className="flex justify-center py-20"><Spinner size={36} /></div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="🛡️"
          title="No incidents match the criteria"
          sub={severity !== 'all' ? `No ${severity} events recorded` : 'All surveillance feeds are clean and normal'}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(inc => (
            <IncidentCard key={inc.id} incident={inc} />
          ))}
        </div>
      )}

      <MotionGuideModal isOpen={guideOpen} onClose={() => setGuideOpen(false)} />
    </div>
  )
}
