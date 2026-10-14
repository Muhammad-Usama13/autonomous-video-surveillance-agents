import { useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../utils/api'
import { useWebSocket } from '../hooks/useWebSocket'
import { Panel, SectionHeader, ProgressBar, SeverityBadge, Spinner, Btn } from '../components/UI'
import IncidentCard from '../components/IncidentCard'
import MotionGuideModal from '../components/MotionGuideModal'
import { clsx } from 'clsx'

const ACCEPTED = ['.mp4', '.avi', '.mov', '.mkv', '.webm']

export default function Upload() {
  const navigate = useNavigate()
  const fileRef  = useRef(null)

  const [dragging,    setDragging]    = useState(false)
  const [file,        setFile]        = useState(null)
  const [previewUrl,  setPreviewUrl]  = useState(null)
  const [uploading,   setUploading]   = useState(false)
  const [uploadPct,   setUploadPct]   = useState(0)
  const [sessionId,   setSessionId]   = useState(null)
  const [progress,    setProgress]    = useState({ processed: 0, total: 0, incidents: 0, pct: 0 })
  const [liveInc,     setLiveInc]     = useState([])
  const [status,      setStatus]      = useState('idle') // idle | uploading | processing | done | error
  const [errorMsg,    setErrorMsg]    = useState('')
  const [guideOpen,   setGuideOpen]   = useState(false)

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

  const onDrop = useCallback(e => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) validateAndSet(f)
  }, [])

  function validateAndSet(f) {
    const ext = '.' + f.name.split('.').pop().toLowerCase()
    if (!ACCEPTED.includes(ext)) {
      setErrorMsg('Unsupported format. Supported: MP4, AVI, MOV, MKV, WebM.')
      return
    }
    setErrorMsg('')
    setFile(f)
    try {
      const url = URL.createObjectURL(f)
      setPreviewUrl(url)
    } catch (_) {}
  }

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
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setFile(null)
    setPreviewUrl(null)
    setSessionId(null)
    setStatus('idle')
    setProgress({ processed: 0, total: 0, incidents: 0, pct: 0 })
    setLiveInc([])
    setErrorMsg('')
    setUploadPct(0)
  }

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-6 lg:p-8">
      {/* ── Top Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-[var(--text-primary)]">
            Upload & Analyze Video
          </h1>
          <p className="text-xs text-[var(--text-muted)] font-mono mt-1">
            Submit footage for YOLOv8 object tracking & SEA-RAFT motion anomaly classification
          </p>
        </div>

        <button
          onClick={() => setGuideOpen(true)}
          className="flex items-center gap-1.5 rounded-xl border border-[var(--accent)]/30 bg-[var(--accent-light)] px-3.5 py-2 text-xs font-semibold text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white transition-all shadow-sm"
        >
          <span>💡</span>
          <span>How AI Analyzes Video</span>
        </button>
      </div>

      {/* ── Pipeline Steps Indicator ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { num: '1', title: 'Upload Footage', desc: 'MP4, AVI, MOV, MKV' },
          { num: '2', title: 'FFmpeg Transcode', desc: 'Universal H.264 Playback' },
          { num: '3', title: 'GPU Inference', desc: 'YOLO (FP16) + SEA-RAFT' },
          { num: '4', title: 'AI Report', desc: 'Gemini Anomaly Synthesis' },
        ].map((step, idx) => (
          <div
            key={step.num}
            className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-3 shadow-sm"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent-light)] text-[var(--accent)] font-bold text-xs">
              {step.num}
            </div>
            <div>
              <p className="text-xs font-bold text-[var(--text-primary)]">{step.title}</p>
              <p className="text-[10px] text-[var(--text-muted)]">{step.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Main Upload & Preview Area ──────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Column: Drag & Drop Zone */}
        <div className="flex flex-col gap-4">
          <Panel>
            <SectionHeader
              icon="📤"
              title="Select Footage"
              sub="Drag & drop or browse your local file system"
            />

            {/* Drop Target */}
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
              className={clsx(
                'flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-all',
                dragging
                  ? 'border-[var(--accent)] bg-[var(--accent-light)] scale-[1.01]'
                  : 'border-[var(--border)] bg-[var(--bg-surface)] hover:border-[var(--border-accent)]'
              )}
            >
              <input
                ref={fileRef}
                type="file"
                accept={ACCEPTED.join(',')}
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0]
                  if (f) validateAndSet(f)
                }}
              />
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--accent-light)] text-3xl mb-3">
                📹
              </div>
              <p className="text-sm font-bold text-[var(--text-primary)]">
                {file ? file.name : 'Click to select or drop surveillance file here'}
              </p>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                Supports MP4, AVI, MOV, MKV, WebM (up to 2 GB)
              </p>
              {file && (
                <div className="mt-3 flex items-center gap-2 rounded-lg bg-[var(--bg-card)] px-3 py-1 text-xs font-mono text-[var(--accent)] border border-[var(--border)]">
                  <span>{(file.size / (1024 * 1024)).toFixed(1)} MB</span>
                  <span>·</span>
                  <span className="text-[var(--success)]">Ready to Analyze</span>
                </div>
              )}
            </div>

            {errorMsg && (
              <div className="mt-3 rounded-lg border border-[var(--danger)]/30 bg-[var(--danger-light)] p-3 text-xs text-[var(--danger)]">
                ⚠️ {errorMsg}
              </div>
            )}

            {/* Actions */}
            <div className="mt-4 flex items-center justify-between gap-3">
              <Btn
                onClick={reset}
                variant="secondary"
                disabled={!file || status === 'uploading' || status === 'processing'}
              >
                Clear File
              </Btn>

              <Btn
                onClick={startUpload}
                disabled={!file || status === 'uploading' || status === 'processing'}
                variant="primary"
                icon="⚡"
              >
                {status === 'uploading' ? `Uploading (${uploadPct}%)` :
                 status === 'processing' ? 'Analyzing on GPU…' :
                 'Begin Autonomous Analysis'}
              </Btn>
            </div>
          </Panel>

          {/* Real-Time Processing Status Panel */}
          {status !== 'idle' && (
            <Panel className="border-[var(--accent)]/30 bg-[var(--bg-card)]">
              <SectionHeader
                icon="⚙️"
                title="Analysis Progress"
                sub={status === 'processing' ? `Analyzing frame ${progress.processed} of ${progress.total}` : status.toUpperCase()}
              />

              <div className="space-y-3">
                <ProgressBar value={status === 'uploading' ? uploadPct : progress.pct} />

                <div className="flex justify-between items-center text-xs font-mono text-[var(--text-muted)]">
                  <span>
                    Status: <strong className="text-[var(--accent)]">{status.toUpperCase()}</strong>
                  </span>
                  <span>{status === 'uploading' ? `${uploadPct}%` : `${progress.pct}%`}</span>
                </div>

                {status === 'done' && (
                  <div className="rounded-xl bg-[var(--success-light)] border border-[var(--success)]/40 p-3 text-xs text-[var(--success)] flex items-center justify-between">
                    <div>
                      <p className="font-bold">✓ Analysis Complete!</p>
                      <p className="text-[11px] mt-0.5">Found {progress.incidents} anomalies.</p>
                    </div>
                    <Btn
                      onClick={() => navigate(`/sessions/${sessionId}`)}
                      variant="primary"
                      className="text-xs"
                    >
                      Open Video Player →
                    </Btn>
                  </div>
                )}
              </div>
            </Panel>
          )}
        </div>

        {/* Right Column: Instant Video Preview & Live Incidents Feed */}
        <div className="flex flex-col gap-4">
          <Panel>
            <SectionHeader
              icon="🎬"
              title="Input Preview"
              sub={file ? file.name : 'No file chosen'}
            />

            {previewUrl ? (
              <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-black aspect-video flex items-center justify-center">
                <video
                  src={previewUrl}
                  controls
                  className="w-full h-full object-contain"
                />
              </div>
            ) : (
              <div className="flex h-56 items-center justify-center rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-surface)] text-center p-6 text-[var(--text-muted)]">
                <div>
                  <div className="text-3xl opacity-30 mb-2">📹</div>
                  <p className="text-xs">Select a video file to view instant preview</p>
                </div>
              </div>
            )}
          </Panel>

          {/* Live Streamed Incidents */}
          <Panel>
            <SectionHeader
              icon="🚨"
              title={`Live Detected Anomalies (${liveInc.length})`}
              sub="Real-time incident stream pushed via WebSocket"
            />

            {liveInc.length > 0 ? (
              <div className="space-y-3 max-h-72 overflow-y-auto">
                {liveInc.map((inc, i) => (
                  <IncidentCard key={i} incident={inc} compact />
                ))}
              </div>
            ) : (
              <div className="p-6 text-center text-xs text-[var(--text-muted)]">
                No incidents detected yet. Start analysis to stream live alerts.
              </div>
            )}
          </Panel>
        </div>
      </div>

      <MotionGuideModal isOpen={guideOpen} onClose={() => setGuideOpen(false)} />
    </div>
  )
}