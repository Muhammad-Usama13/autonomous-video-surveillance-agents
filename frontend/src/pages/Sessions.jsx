import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, formatTs } from '../utils/api'
import { Panel, SectionHeader, StatusDot, ProgressBar, EmptyState, Spinner, Btn } from '../components/UI'

export default function Sessions() {
  const navigate = useNavigate()
  const [sessions, setSessions] = useState([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    api.getSessions().then(s => { setSessions(s || []); setLoading(false) })
    const id = setInterval(() => api.getSessions().then(s => setSessions(s || [])), 5000)
    return () => clearInterval(id)
  }, [])

  async function deleteSession(id, e) {
    e.stopPropagation()
    if (!confirm('Delete this session and all its incidents?')) return
    await api.deleteSession(id)
    setSessions(prev => prev.filter(s => s.session_id !== id))
  }

  if (loading) return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center space-y-3">
        <Spinner size={36} />
        <p className="font-mono text-xs text-[var(--text-muted)]">Loading recorded sessions...</p>
      </div>
    </div>
  )

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-6 lg:p-8">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-[var(--text-primary)]">
            Recorded Video Sessions
          </h1>
          <p className="text-xs text-[var(--text-muted)] font-mono mt-1">
            {sessions.length} PROCESSED ARCHIVE{sessions.length !== 1 ? 'S' : ''}
          </p>
        </div>
        <Btn onClick={() => navigate('/upload')} variant="primary" icon="+">
          New Analysis
        </Btn>
      </div>

      {sessions.length === 0 ? (
        <EmptyState
          icon="📹"
          title="No video sessions found"
          sub="Upload surveillance video footage to generate autonomous analysis sessions"
          action={
            <Btn onClick={() => navigate('/upload')} variant="primary" icon="📤">
              Upload Video Now
            </Btn>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sessions.map(s => (
            <div
              key={s.session_id}
              className="cursor-pointer rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5 hover:border-[var(--accent)] hover:shadow-md transition-all flex flex-col justify-between"
              onClick={() => navigate(`/sessions/${s.session_id}`)}
            >
              <div>
                {/* Header Row */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <StatusDot status={s.status} />
                    <p className="font-bold text-sm text-[var(--text-primary)] truncate max-w-[200px]">
                      {s.video_name}
                    </p>
                  </div>
                  <button
                    onClick={e => deleteSession(s.session_id, e)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--danger-light)] transition-colors"
                    title="Delete session"
                  >
                    ✕
                  </button>
                </div>

                {/* Status Indicator */}
                <div className="flex items-center gap-2 mb-3">
                  <span
                    className="font-mono text-[10px] font-bold uppercase tracking-wider rounded-md px-2 py-0.5"
                    style={{
                      background: s.status === 'done' ? 'var(--success-light)' :
                                  s.status === 'processing' ? 'var(--warn-light)' : 'var(--danger-light)',
                      color: s.status === 'done' ? 'var(--success)' :
                             s.status === 'processing' ? 'var(--warn)' : 'var(--danger)',
                    }}
                  >
                    {s.status}
                  </span>
                  {s.status === 'processing' && <Spinner size={12} />}
                </div>

                {/* Progress bar if processing */}
                {s.status === 'processing' && (
                  <div className="mb-3 space-y-1">
                    <ProgressBar value={s.progress_pct} />
                    <p className="font-mono text-[10px] text-[var(--text-muted)] text-right">
                      {s.progress_pct}%
                    </p>
                  </div>
                )}
              </div>

              {/* Stats Box */}
              <div>
                <div className="grid grid-cols-2 gap-2 text-center mt-3 pt-3 border-t border-[var(--border)]">
                  <div className="rounded-xl bg-[var(--bg-surface)] p-2.5">
                    <p className="font-mono text-[9px] uppercase tracking-wider text-[var(--text-muted)]">
                      Incidents
                    </p>
                    <p className="text-xl font-bold text-[var(--accent)] mt-0.5">
                      {s.incidents}
                    </p>
                  </div>
                  <div className="rounded-xl bg-[var(--bg-surface)] p-2.5">
                    <p className="font-mono text-[9px] uppercase tracking-wider text-[var(--text-muted)]">
                      Started
                    </p>
                    <p className="text-[11px] font-mono text-[var(--text-secondary)] mt-1 truncate">
                      {formatTs(s.started_at)}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between text-[11px] font-mono text-[var(--text-muted)]">
                  <span className="truncate">ID: {s.session_id.slice(0, 12)}…</span>
                  <span className="text-[var(--accent)] font-semibold group-hover:underline">
                    View Player →
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}