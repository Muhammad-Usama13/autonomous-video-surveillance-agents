import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, formatTs } from '../utils/api'
import { Panel, SectionHeader, StatusDot, ProgressBar, EmptyState, Spinner, Btn } from '../components/UI'

export default function Sessions() {
  const navigate = useNavigate()
  const [sessions, setSessions] = useState([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    api.getSessions().then(s => { setSessions(s); setLoading(false) })
    const id = setInterval(() => api.getSessions().then(setSessions), 5000)
    return () => clearInterval(id)
  }, [])

  async function deleteSession(id, e) {
    e.stopPropagation()
    if (!confirm('Delete this session and all its incidents?')) return
    await api.deleteSession(id)
    setSessions(prev => prev.filter(s => s.session_id !== id))
  }

  if (loading) return (
    <div className="flex h-full items-center justify-center"><Spinner size={36} /></div>
  )

  return (
    <div className="flex h-full flex-col gap-5 overflow-auto p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl tracking-[0.15em] text-[var(--accent)]">SESSIONS</h1>
          <p className="font-mono text-[11px] text-[var(--muted)] mt-1">
            {sessions.length} ANALYSIS SESSION{sessions.length !== 1 && 'S'}
          </p>
        </div>
        <Btn onClick={() => navigate('/upload')}>+ NEW</Btn>
      </div>

      {sessions.length === 0 ? (
        <EmptyState icon="📹" title="No sessions yet" sub="Upload a video to start" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sessions.map(s => (
            <div
              key={s.session_id}
              className="cursor-pointer rounded-lg border border-[#1a2236] bg-[#0e1420] p-4 hover:border-[var(--accent)]/40 transition-all"
              onClick={() => navigate(`/sessions/${s.session_id}`)}
            >
              {/* Top row */}
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <StatusDot status={s.status} />
                  <p className="font-mono text-xs text-slate-200 truncate">{s.video_name}</p>
                </div>
                <button
                  onClick={e => deleteSession(s.session_id, e)}
                  className="shrink-0 text-[var(--muted)] hover:text-[var(--danger)] font-mono text-xs transition-colors"
                >
                  ✕
                </button>
              </div>

              {/* Status label */}
              <div className="flex items-center gap-2 mb-3">
                <span
                  className="font-mono text-[10px] uppercase tracking-widest"
                  style={{
                    color: s.status === 'done'       ? 'var(--success)' :
                           s.status === 'processing' ? 'var(--warn)'    :
                           s.status === 'error'      ? 'var(--danger)'  : 'var(--muted)'
                  }}
                >
                  {s.status}
                </span>
                {s.status === 'processing' && <Spinner size={12} />}
              </div>

              {/* Progress */}
              {s.status === 'processing' && (
                <div className="mb-3">
                  <ProgressBar value={s.progress_pct} />
                  <p className="mt-1 font-mono text-[10px] text-[var(--muted)]">{s.progress_pct}%</p>
                </div>
              )}

              {/* Stats */}
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="rounded bg-[#0a0d12] p-2">
                  <p className="font-mono text-[9px] text-[var(--muted)] uppercase">Incidents</p>
                  <p className="font-display text-xl text-[var(--accent)]">{s.incidents}</p>
                </div>
                <div className="rounded bg-[#0a0d12] p-2">
                  <p className="font-mono text-[9px] text-[var(--muted)] uppercase">Started</p>
                  <p className="font-mono text-[10px] text-slate-400">{formatTs(s.started_at)}</p>
                </div>
              </div>

              {/* Session ID */}
              <p className="mt-3 font-mono text-[9px] text-[var(--muted)] truncate">
                ID: {s.session_id}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}