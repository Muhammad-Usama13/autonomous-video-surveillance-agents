import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { severityColor, eventIcon, formatTs } from '../utils/api'
import { Panel, SectionHeader, SeverityBadge, EmptyState, Spinner, Btn } from '../components/UI'
import { clsx } from 'clsx'

// ── helpers ───────────────────────────────────────────────────────────────────
async function fetchVideoInfo(sessionId) {
  const res = await fetch(`/api/sessions/${sessionId}/video-info`)
  if (!res.ok) throw new Error('Failed to load session')
  return res.json()
}

function tsToSeconds(ts) {
  // "HH:MM:SS" → seconds
  if (!ts) return 0
  const [h, m, s] = ts.split(':').map(Number)
  return h * 3600 + m * 60 + s
}

function secondsToTs(sec) {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  return [h, m, s].map(n => String(n).padStart(2, '0')).join(':')
}

const SEV_ORDER = { critical: 4, high: 3, medium: 2, low: 1 }

// ── VideoPlayer component ────────────────────────────────────────────────────
function VideoPlayerWidget({ src, title, badge, onTimeUpdate, seekTo, children }) {
  const videoRef = useRef(null)
  const [playing,  setPlaying]  = useState(false)
  const [current,  setCurrent]  = useState(0)
  const [duration, setDuration] = useState(0)
  const [muted,    setMuted]    = useState(false)
  const [volume,   setVolume]   = useState(1)

  // External seek
  useEffect(() => {
    if (seekTo !== undefined && seekTo !== null && videoRef.current) {
      videoRef.current.currentTime = seekTo
      videoRef.current.play()
      setPlaying(true)
    }
  }, [seekTo])

  const togglePlay = () => {
    const v = videoRef.current
    if (!v) return
    if (v.paused) { v.play(); setPlaying(true) }
    else          { v.pause(); setPlaying(false) }
  }

  const handleTimeUpdate = () => {
    const v = videoRef.current
    if (!v) return
    setCurrent(v.currentTime)
    onTimeUpdate?.(v.currentTime)
  }

  const handleScrub = e => {
    const v = videoRef.current
    if (!v || !duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const pct  = (e.clientX - rect.left) / rect.width
    v.currentTime = pct * duration
  }

  const pct = duration ? (current / duration) * 100 : 0

  return (
    <div className="flex flex-col rounded-lg border border-[#1a2236] bg-[#0a0d12] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#1a2236]">
        <div className="flex items-center gap-2">
          <span className="text-[var(--accent)] text-sm">▶</span>
          <p className="font-mono text-xs text-slate-300 truncate max-w-[200px]">{title}</p>
        </div>
        {badge && (
          <span className="font-mono text-[9px] uppercase tracking-widest rounded border px-2 py-0.5"
            style={{ color: 'var(--accent)', borderColor: 'var(--accent)', background: 'rgba(0,229,255,0.08)' }}>
            {badge}
          </span>
        )}
      </div>

      {/* Video */}
      <div className="relative bg-black aspect-video">
        {src ? (
          <video
            ref={videoRef}
            src={src}
            className="w-full h-full object-contain"
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={() => setDuration(videoRef.current?.duration || 0)}
            onEnded={() => setPlaying(false)}
            muted={muted}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-[var(--muted)]">
            <div className="text-center">
              <div className="text-4xl opacity-20 mb-2">🎬</div>
              <p className="font-mono text-xs">No video available</p>
            </div>
          </div>
        )}

        {/* Big play overlay */}
        {src && !playing && (
          <button
            onClick={togglePlay}
            className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/20 transition-all group"
          >
            <div className="h-16 w-16 rounded-full border-2 border-[var(--accent)] flex items-center justify-center bg-black/60 group-hover:scale-110 transition-transform">
              <span className="text-[var(--accent)] text-2xl ml-1">▶</span>
            </div>
          </button>
        )}
      </div>

      {/* Controls */}
      {src && (
        <div className="px-4 py-3 space-y-2">
          {/* Scrubber */}
          <div
            className="h-1.5 w-full rounded-full bg-[#1a2236] cursor-pointer relative group"
            onClick={handleScrub}
          >
            <div
              className="h-full rounded-full bg-[var(--accent)] transition-all pointer-events-none"
              style={{ width: `${pct}%` }}
            />
            {/* Tooltip dot */}
            <div
              className="absolute top-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-[var(--accent)] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
              style={{ left: `${pct}%`, transform: 'translate(-50%,-50%)' }}
            />
            {children /* incident markers injected here */}
          </div>

          {/* Buttons row */}
          <div className="flex items-center gap-3">
            <button
              onClick={togglePlay}
              className="font-mono text-xs text-[var(--accent)] hover:opacity-80 transition-opacity"
            >
              {playing ? '⏸' : '▶'}
            </button>
            <button
              onClick={() => { setMuted(m => !m); if (videoRef.current) videoRef.current.muted = !muted }}
              className="font-mono text-xs text-[var(--muted)] hover:text-slate-300 transition-colors"
            >
              {muted ? '🔇' : '🔊'}
            </button>
            <input
              type="range" min="0" max="1" step="0.05"
              value={muted ? 0 : volume}
              onChange={e => {
                const v = parseFloat(e.target.value)
                setVolume(v)
                setMuted(v === 0)
                if (videoRef.current) videoRef.current.volume = v
              }}
              className="w-16 h-1 accent-[var(--accent)]"
            />
            <span className="ml-auto font-mono text-[10px] text-[var(--muted)]">
              {secondsToTs(current)} / {secondsToTs(duration)}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Incident timeline marker ──────────────────────────────────────────────────
function TimelineMarker({ incident, duration, onClick, active }) {
  if (!duration) return null
  const pct = Math.min(100, (tsToSeconds(incident.timestamp) / duration) * 100)
  const color = severityColor(incident.severity)
  return (
    <div
      className="absolute top-1/2 -translate-y-1/2 cursor-pointer z-10 group"
      style={{ left: `${pct}%` }}
      onClick={e => { e.stopPropagation(); onClick(incident) }}
      title={`${incident.timestamp} — ${incident.event_type?.replace(/_/g, ' ')}`}
    >
      <div
        className={clsx(
          'h-3.5 w-1.5 rounded-sm transition-all',
          active ? 'scale-150' : 'group-hover:scale-125'
        )}
        style={{ background: color, boxShadow: active ? `0 0 6px ${color}` : 'none' }}
      />
    </div>
  )
}

// ── Incident summary card ─────────────────────────────────────────────────────
function IncidentSummaryCard({ incident, active, onClick }) {
  const color = severityColor(incident.severity)
  return (
    <button
      onClick={onClick}
      className={clsx(
        'w-full text-left rounded-lg border p-3 transition-all hover:border-[var(--accent)]/40',
        active
          ? 'border-[var(--accent)]/60 bg-[rgba(0,229,255,0.06)]'
          : 'border-[#1a2236] bg-[#0a0d12]'
      )}
    >
      <div className="flex items-start gap-2.5 mb-1.5">
        <span className="text-base leading-none mt-0.5">{eventIcon(incident.event_type)}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-[10px] font-semibold text-slate-200 uppercase tracking-wider">
              {incident.event_type?.replace(/_/g, ' ')}
            </span>
            <SeverityBadge severity={incident.severity} />
          </div>
          <span className="font-mono text-[10px] text-[var(--accent)]">{incident.timestamp}</span>
        </div>
        <span
          className="font-mono text-[10px] shrink-0"
          style={{ color: incident.confidence > 0.7 ? 'var(--danger)' : 'var(--warn)' }}
        >
          {(incident.confidence * 100).toFixed(0)}%
        </span>
      </div>
      <p className="text-xs text-slate-400 leading-relaxed line-clamp-2 pl-7">
        {incident.description}
      </p>
    </button>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function VideoPlayer() {
  const { sessionId } = useParams()
  const navigate = useNavigate()

  const [info,          setInfo]          = useState(null)
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState(null)
  const [activeInc,     setActiveInc]     = useState(null)
  const [seekTo,        setSeekTo]        = useState(null)
  const [videoDuration, setVideoDuration] = useState(0)
  const [currentTime,   setCurrentTime]   = useState(0)
  const [activeTab,     setActiveTab]     = useState('original')
  const [frameSeek,     setFrameSeek]     = useState(null)
  const [severityFilter, setSeverityFilter] = useState('all')
  const [webReady,      setWebReady]      = useState(false)

  useEffect(() => {
    fetchVideoInfo(sessionId)
      .then(d => {
        setInfo(d)
        setWebReady(d.web_ready)
        setLoading(false)
      })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [sessionId])

  // Poll every 3s until web-compatible video is ready (transcoding in background)
  useEffect(() => {
    if (webReady || !info) return
    const id = setInterval(async () => {
      try {
        const d = await fetchVideoInfo(sessionId)
        if (d.web_ready) {
          setWebReady(true)
          setInfo(d)
          clearInterval(id)
        }
      } catch (_) {}
    }, 3000)
    return () => clearInterval(id)
  }, [webReady, info, sessionId])

  // Auto-highlight nearest incident as video plays
  useEffect(() => {
    if (!info?.timeline?.length) return
    const nearest = info.timeline.reduce((best, inc) => {
      const diff = Math.abs(tsToSeconds(inc.timestamp) - currentTime)
      return diff < Math.abs(tsToSeconds(best.timestamp) - currentTime) ? inc : best
    })
    if (Math.abs(tsToSeconds(nearest.timestamp) - currentTime) < 3) {
      setActiveInc(nearest)
    }
  }, [currentTime, info])

  const handleIncidentClick = useCallback((incident) => {
    setActiveInc(incident)
    const secs = tsToSeconds(incident.timestamp)
    setSeekTo(secs)
    setFrameSeek(secs)
    setActiveTab('original')
  }, [])

  const filteredTimeline = info?.timeline?.filter(
    inc => severityFilter === 'all' || inc.severity === severityFilter
  ) || []

  // Stats for summary bar
  const stats = info ? {
    critical: info.timeline.filter(i => i.severity === 'critical').length,
    high:     info.timeline.filter(i => i.severity === 'high').length,
    medium:   info.timeline.filter(i => i.severity === 'medium').length,
    low:      info.timeline.filter(i => i.severity === 'low').length,
  } : {}

  if (loading) return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center space-y-3">
        <Spinner size={36} />
        <p className="font-mono text-xs text-[var(--muted)]">Loading session...</p>
      </div>
    </div>
  )

  if (error) return (
    <div className="flex h-full items-center justify-center">
      <EmptyState icon="⚠️" title={error} sub="Check the session ID and try again" />
    </div>
  )

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* ── Top bar ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 border-b border-[#1a2236] px-6 py-3 shrink-0">
        <button
          onClick={() => navigate('/sessions')}
          className="font-mono text-xs text-[var(--muted)] hover:text-[var(--accent)] transition-colors"
        >
          ← SESSIONS
        </button>
        <div className="h-4 w-px bg-[#1a2236]" />
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-xl tracking-widest text-[var(--accent)] truncate">
            {info.video_name}
          </h1>
          <p className="font-mono text-[10px] text-[var(--muted)]">
            SESSION · {sessionId?.slice(0, 16)}… · {info.total_incidents} INCIDENT{info.total_incidents !== 1 ? 'S' : ''}
          </p>
        </div>
        {/* Severity pills */}
        <div className="flex items-center gap-2 shrink-0">
          {Object.entries(stats).map(([sev, count]) => count > 0 && (
            <div key={sev} className="flex items-center gap-1 rounded px-2 py-0.5"
              style={{ background: `${severityColor(sev)}18` }}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: severityColor(sev) }} />
              <span className="font-mono text-[10px]" style={{ color: severityColor(sev) }}>
                {count} {sev}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Main content ─────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left: video players ────────────────────────────────────────────── */}
        <div className="flex flex-col flex-1 overflow-y-auto p-5 gap-5 min-w-0">

          {/* Transcoding notice */}
          {!webReady && (
            <div className="flex items-center gap-3 rounded-lg border border-[var(--warn)]/40 bg-[var(--warn)]/08 px-4 py-3">
              <Spinner size={14} />
              <div>
                <p className="font-mono text-xs text-[var(--warn)] font-semibold">
                  TRANSCODING VIDEO FOR BROWSER PLAYBACK
                </p>
                <p className="font-mono text-[10px] text-[var(--muted)] mt-0.5">
                  Your AVI/MOV file is being converted to H.264 MP4. This takes 30–120 seconds.
                  The incident frames are available now.
                </p>
              </div>
            </div>
          )}

          {/* Tab switcher */}
          <div className="flex gap-2">
            {['original', 'frame'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={clsx(
                  'font-mono text-[10px] uppercase tracking-widest rounded px-4 py-1.5 border transition-all',
                  activeTab === tab
                    ? 'border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/10'
                    : 'border-[#1a2236] text-[var(--muted)] hover:border-[var(--accent)]/30'
                )}
              >
                {tab === 'original' ? '🎬 Original Video' : '🔍 Incident Frame'}
              </button>
            ))}
          </div>

          {/* Original video player */}
          {activeTab === 'original' && (
            <div>
              <VideoPlayerWidget
                src={info.video_url}
                title={info.video_name}
                badge="ORIGINAL FOOTAGE"
                seekTo={seekTo}
                onTimeUpdate={t => {
                  setCurrentTime(t)
                  const v = document.querySelector('video')
                  if (v && v.duration) setVideoDuration(v.duration)
                }}
              >
                {/* Incident markers on scrubber */}
                {videoDuration > 0 && info.timeline.map(inc => (
                  <TimelineMarker
                    key={inc.id}
                    incident={inc}
                    duration={videoDuration}
                    active={activeInc?.id === inc.id}
                    onClick={handleIncidentClick}
                  />
                ))}
              </VideoPlayerWidget>

              {/* Active incident popup below video */}
              {activeInc && (
                <div
                  className="mt-3 rounded-lg border p-4 transition-all"
                  style={{
                    borderColor: `${severityColor(activeInc.severity)}40`,
                    background:  `${severityColor(activeInc.severity)}08`,
                  }}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xl">{eventIcon(activeInc.event_type)}</span>
                    <div>
                      <p className="font-mono text-xs font-semibold text-slate-200 uppercase tracking-wider">
                        {activeInc.event_type?.replace(/_/g, ' ')}
                      </p>
                      <p className="font-mono text-[10px] text-[var(--accent)]">@ {activeInc.timestamp}</p>
                    </div>
                    <SeverityBadge severity={activeInc.severity} />
                    <button
                      onClick={() => setActiveInc(null)}
                      className="ml-auto text-[var(--muted)] hover:text-slate-300 font-mono text-xs"
                    >✕</button>
                  </div>
                  <p className="text-sm text-slate-400 leading-relaxed border-l-2 pl-3"
                    style={{ borderColor: severityColor(activeInc.severity) }}>
                    {activeInc.description}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Incident frame viewer */}
          {activeTab === 'frame' && (
            <div>
              {activeInc?.frame_url ? (
                <div className="rounded-lg border border-[#1a2236] overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#1a2236] bg-[#0a0d12]">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{eventIcon(activeInc.event_type)}</span>
                      <p className="font-mono text-xs text-slate-300 uppercase tracking-wider">
                        {activeInc.event_type?.replace(/_/g, ' ')}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-[10px] text-[var(--accent)]">
                        @ {activeInc.timestamp}
                      </span>
                      <SeverityBadge severity={activeInc.severity} />
                    </div>
                  </div>
                  <div className="relative bg-black">
                    <img
                      src={activeInc.frame_url}
                      alt={`Incident at ${activeInc.timestamp}`}
                      className="w-full object-contain max-h-[420px]"
                    />
                    {/* Severity overlay badge */}
                    <div
                      className="absolute top-3 left-3 rounded px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-widest"
                      style={{
                        background: `${severityColor(activeInc.severity)}cc`,
                        color: '#000',
                      }}
                    >
                      {activeInc.severity} · {(activeInc.confidence * 100).toFixed(0)}% confidence
                    </div>
                  </div>
                  {/* Description under frame */}
                  <div className="p-4 bg-[#0a0d12] border-t border-[#1a2236]">
                    <p className="font-mono text-[10px] text-[var(--muted)] uppercase tracking-wider mb-1">
                      AI Analysis
                    </p>
                    <p className="text-sm text-slate-300 leading-relaxed">{activeInc.description}</p>
                  </div>
                </div>
              ) : (
                <EmptyState
                  icon="🔍"
                  title="Select an incident from the timeline"
                  sub="Click any incident card on the right to view its annotated frame"
                />
              )}
            </div>
          )}

          {/* ── AI Summary ─────────────────────────────────────────────────── */}
          <Panel className="border-[var(--accent)]/20">
            <SectionHeader icon="🤖" title="AI ANALYSIS SUMMARY" />
            <p className="text-sm text-slate-300 leading-relaxed">{info.summary}</p>

            {/* Stats grid */}
            {info.total_incidents > 0 && (
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: 'Total',    val: info.total_incidents, color: 'var(--accent)' },
                  { label: 'Critical', val: stats.critical,       color: 'var(--danger)' },
                  { label: 'High',     val: stats.high,           color: '#ff6b35' },
                  { label: 'Medium',   val: stats.medium,         color: 'var(--warn)' },
                ].map(({ label, val, color }) => (
                  <div key={label} className="rounded bg-[#0a0d12] p-3 text-center">
                    <p className="font-mono text-[9px] text-[var(--muted)] uppercase tracking-wider">{label}</p>
                    <p className="font-display text-2xl mt-0.5" style={{ color }}>{val}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Timestamps list */}
            {info.total_incidents > 0 && (
              <div className="mt-4">
                <p className="font-mono text-[10px] text-[var(--muted)] uppercase tracking-wider mb-2">
                  Event Timeline
                </p>
                <div className="flex flex-wrap gap-2">
                  {info.timeline.map(inc => (
                    <button
                      key={inc.id}
                      onClick={() => handleIncidentClick(inc)}
                      className="flex items-center gap-1.5 rounded border px-2 py-1 font-mono text-[10px] transition-all hover:opacity-80"
                      style={{
                        borderColor: `${severityColor(inc.severity)}50`,
                        background:  `${severityColor(inc.severity)}12`,
                        color:        severityColor(inc.severity),
                      }}
                    >
                      {eventIcon(inc.event_type)} {inc.timestamp}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </Panel>
        </div>

        {/* Right: incident list ────────────────────────────────────────────── */}
        <div className="w-[320px] shrink-0 border-l border-[#1a2236] flex flex-col overflow-hidden">
          {/* Header + filter */}
          <div className="px-4 py-3 border-b border-[#1a2236] space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-display text-base tracking-widest text-[var(--accent)]">INCIDENTS</p>
              <span className="font-mono text-[10px] text-[var(--muted)]">
                {filteredTimeline.length} shown
              </span>
            </div>
            {/* Severity filter pills */}
            <div className="flex gap-1.5 flex-wrap">
              {['all', 'critical', 'high', 'medium', 'low'].map(sev => (
                <button
                  key={sev}
                  onClick={() => setSeverityFilter(sev)}
                  className={clsx(
                    'font-mono text-[9px] uppercase tracking-widest rounded px-2 py-1 border transition-all',
                    severityFilter === sev
                      ? 'border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/10'
                      : 'border-[#1a2236] text-[var(--muted)] hover:border-[var(--accent)]/30'
                  )}
                >
                  {sev}
                </button>
              ))}
            </div>
          </div>

          {/* Incident cards list */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {filteredTimeline.length === 0 ? (
              <EmptyState icon="✅" title="No incidents" sub="Try changing the severity filter" />
            ) : (
              filteredTimeline
                .sort((a, b) => (SEV_ORDER[b.severity] || 0) - (SEV_ORDER[a.severity] || 0))
                .map(inc => (
                  <IncidentSummaryCard
                    key={inc.id}
                    incident={inc}
                    active={activeInc?.id === inc.id}
                    onClick={() => {
                      handleIncidentClick(inc)
                      setActiveTab('frame')
                    }}
                  />
                ))
            )}
          </div>

          {/* Bottom action */}
          {info.total_incidents > 0 && (
            <div className="border-t border-[#1a2236] p-3">
              <button
                onClick={() => navigate(`/incidents?session=${sessionId}`)}
                className="w-full font-mono text-[10px] text-[var(--accent)] hover:underline tracking-wider"
              >
                VIEW FULL INCIDENT TABLE →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}