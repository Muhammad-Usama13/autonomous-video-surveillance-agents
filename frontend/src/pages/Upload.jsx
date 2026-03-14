import { useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../utils/api'
import { useWebSocket } from '../hooks/useWebSocket'
import { Panel, SectionHeader, ProgressBar, SeverityBadge, Spinner, Btn } from '../components/UI'
import IncidentCard from '../components/IncidentCard'
import { clsx } from 'clsx'

const ACCEPTED = ['.mp4', '.avi', '.mov', '.mkv', '.webm']

export default function Upload() {
  const navigate = useNavigate()
  const fileRef  = useRef(null)

  const [dragging,    setDragging]    = useState(false)
  const [file,        setFile]        = useState(null)
  const [uploading,   setUploading]   = useState(false)
  const [uploadPct,   setUploadPct]   = useState(0)
  const [sessionId,   setSessionId]   = useState(null)
  const [progress,    setProgress]    = useState({ processed: 0, total: 0, incidents: 0, pct: 0 })
  const [liveInc,     setLiveInc]     = useState([])
  const [status,      setStatus]      = useState('idle') // idle | uploading | processing | done | error
  const [errorMsg,    setErrorMsg]    = useState('')

  // WebSocket for live progress
  useWebSocket(sessionId, msg => {
    if (msg.type === 'progress') {
      const d = msg.data
      setProgress({ processed: d.processed, total: d.total, incidents: d.incidents, pct: d.progress_pct })
    }
    if (msg.type === 'incident') {
      setLiveInc(prev => [msg.data, ...prev])
    }
    if (msg.type === 'done') {
      setStatus('done')
    }
    if (msg.type === 'error') {
      setStatus('error')
      setErrorMsg(msg.data.message)
    }
  })

  // ── Drag & drop ───────────────────────────────────────────────────────
  const onDrop = useCallback(e => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) validateAndSet(f)
  }, [])

  function validateAndSet(f) {
    const ext = '.' + f.name.split('.').pop().toLowerCase()
    if (!ACCEPTED.includes(ext)) {
      setErrorMsg('Unsupported format. Use MP4, AVI, MOV, MKV, or WebM.')
      return
    }
    setErrorMsg('')
    setFile(f)
  }

  // ── Upload ────────────────────────────────────────────────────────────
  async function startUpload() {
    if (!file) return
    setUploading(true)
    setStatus('uploading')
    setLiveInc([])
    try {
      const session = await api.uploadVideo(file, pct => setUploadPct(pct))
      setSessionId(session.session_id)
      setStatus('processing')
    } catch (err) {
      setStatus('error')
      setErrorMsg(err.message)
    } finally {
      setUploading(false)
    }
  }

  function reset() {
    setFile(null); setSessionId(null); setStatus('idle')
    setProgress({ processed: 0, total: 0, incidents: 0, pct: 0 })
    setLiveInc([]); setErrorMsg(''); setUploadPct(0)
  }

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full flex-col gap-5 overflow-auto p-6">
      <div>
        <h1 className="font-display text-3xl tracking-[0.15em] text-[var(--accent)]">
          VIDEO UPLOAD
        </h1>
        <p className="font-mono text-[11px] text-[var(--muted)] mt-1">
          SUBMIT SURVEILLANCE FOOTAGE FOR AI ANALYSIS
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Left: upload panel */}
        <div className="flex flex-col gap-4">
          {/* Drop zone */}
          <Panel
            className={clsx(
              'relative flex min-h-[220px] cursor-pointer flex-col items-center justify-center gap-4 border-dashed transition-all',
              dragging  && 'border-[var(--accent)] bg-[rgba(0,229,255,0.04)]',
              status === 'idle' && 'hover:border-[var(--accent)]/50',
              file && 'border-[var(--accent)]/40'
            )}
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => status === 'idle' && fileRef.current?.click()}
          >
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPTED.join(',')}
              className="hidden"
              onChange={e => validateAndSet(e.target.files[0])}
            />

            {!file ? (
              <>
                <div className="text-5xl opacity-30">🎬</div>
                <div className="text-center">
                  <p className="font-mono text-sm text-slate-300">
                    {dragging ? 'DROP IT' : 'Drag & drop video'}
                  </p>
                  <p className="font-mono text-[11px] text-[var(--muted)] mt-1">
                    or click to browse · {ACCEPTED.join(' ')}
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="text-5xl">🎥</div>
                <div className="text-center">
                  <p className="font-mono text-sm text-[var(--accent)]">{file.name}</p>
                  <p className="font-mono text-[11px] text-[var(--muted)] mt-1">
                    {(file.size / 1024 / 1024).toFixed(1)} MB
                  </p>
                </div>
              </>
            )}
          </Panel>

          {/* Error */}
          {errorMsg && (
            <div className="rounded border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-4 py-3 font-mono text-xs text-[var(--danger)]">
              ⚠ {errorMsg}
            </div>
          )}

          {/* Actions */}
          {status === 'idle' && (
            <Btn onClick={startUpload} disabled={!file} className="w-full justify-center py-3">
              ▶ START ANALYSIS
            </Btn>
          )}
          {status === 'done' && (
            <div className="flex gap-3">
              <Btn onClick={() => navigate(`/sessions/${sessionId}`)} className="flex-1 justify-center">
                ▶ WATCH & REVIEW
              </Btn>
              <Btn onClick={reset} variant="ghost">NEW</Btn>
            </div>
          )}
          {(status === 'error') && (
            <Btn onClick={reset} variant="ghost" className="w-full justify-center">RESET</Btn>
          )}
        </div>

        {/* Right: live progress */}
        <div className="flex flex-col gap-4">
          {/* Upload progress */}
          {status === 'uploading' && (
            <Panel>
              <SectionHeader icon="↑" title="UPLOADING" />
              <ProgressBar value={uploadPct} />
              <p className="mt-2 font-mono text-[11px] text-[var(--muted)]">{uploadPct}% uploaded</p>
            </Panel>
          )}

          {/* Analysis progress */}
          {(status === 'processing' || status === 'done') && (
            <Panel className={status === 'done' ? 'border-[var(--success)]/30' : ''}>
              <div className="flex items-center justify-between mb-3">
                <SectionHeader
                  icon={status === 'done' ? '✅' : '⚙️'}
                  title={status === 'done' ? 'ANALYSIS COMPLETE' : 'ANALYSING'}
                />
                {status === 'processing' && <Spinner />}
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                {[
                  { label: 'FRAMES',   val: progress.processed },
                  { label: 'PROGRESS', val: `${progress.pct}%` },
                  { label: 'ALERTS',   val: liveInc.length },
                ].map(({ label, val }) => (
                  <div key={label} className="rounded bg-[#0a0d12] p-2 text-center">
                    <p className="font-mono text-[9px] text-[var(--muted)] uppercase tracking-wider">{label}</p>
                    <p className="font-display text-lg text-[var(--accent)]">{val}</p>
                  </div>
                ))}
              </div>

              <ProgressBar value={progress.pct} color={status === 'done' ? 'var(--success)' : 'var(--accent)'} />
            </Panel>
          )}

          {/* Live incident feed */}
          {liveInc.length > 0 && (
            <Panel>
              <SectionHeader icon="🔴" title="LIVE DETECTIONS" sub={`${liveInc.length} events so far`} />
              <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
                {liveInc.map((inc, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 rounded bg-[#0a0d12] px-3 py-2 border border-[#1a2236]"
                  >
                    <span className="font-mono text-xs text-[var(--accent)]">{inc.timestamp}</span>
                    <span className="font-mono text-[11px] text-slate-300 flex-1 truncate">
                      {inc.event_type?.replace(/_/g, ' ')}
                    </span>
                    <SeverityBadge severity={inc.severity} />
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {/* Idle hint */}
          {status === 'idle' && (
            <Panel className="opacity-60">
              <SectionHeader icon="ℹ" title="HOW IT WORKS" />
              <ol className="space-y-2 font-mono text-[11px] text-[var(--muted)]">
                {[
                  'Upload a surveillance video',
                  'YOLOv8 detects people & objects',
                  'RAFT analyses motion patterns',
                  'AI classifies suspicious behaviour',
                  'Gemini generates incident reports',
                  'Alerts sent in real-time',
                ].map((step, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="text-[var(--accent)]">{i + 1}.</span> {step}
                  </li>
                ))}
              </ol>
            </Panel>
          )}
        </div>
      </div>
    </div>
  )
}