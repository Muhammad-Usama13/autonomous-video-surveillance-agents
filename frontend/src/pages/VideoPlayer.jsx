import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { severityColor, eventIcon, formatTs, getFrameUrl } from '../utils/api'
import { Panel, SectionHeader, SeverityBadge, EmptyState, Spinner, Btn } from '../components/UI'
import MotionActivityGauge from '../components/MotionActivityGauge'
import MotionGuideModal from '../components/MotionGuideModal'
import { clsx } from 'clsx'

async function fetchVideoInfo(sessionId) {
  const res = await fetch(`/api/sessions/${sessionId}/video-info`)
  if (!res.ok) throw new Error('Failed to load session details')
  return res.json()
}

function tsToSeconds(ts) {
  if (!ts) return 0
  const parts = ts.split(':').map(Number)
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  return 0
}

function secondsToTs(sec) {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  return [h, m, s].map(n => String(n).padStart(2, '0')).join(':')
}

// ── Enhanced Video Player Widget ─────────────────────────────────────────────
function VideoPlayerWidget({
  src,
  title,
  badge,
  streamMode,
  setStreamMode,
  hasAnnotated,
  onTimeUpdate,
  seekTo,
  children
}) {
  const videoRef = useRef(null)
  const [playing,  setPlaying]  = useState(false)
  const [current,  setCurrent]  = useState(0)
  const [duration, setDuration] = useState(0)
  const [muted,    setMuted]    = useState(false)

  useEffect(() => {
    if (seekTo !== undefined && seekTo !== null && videoRef.current) {
      videoRef.current.currentTime = seekTo
      videoRef.current.play().catch(() => {})
      setPlaying(true)
    }
  }, [seekTo])

  const handleToggleStream = (newMode) => {
    if (newMode === streamMode) return
    const curTime = videoRef.current ? videoRef.current.currentTime : current
    setStreamMode(newMode)
    setTimeout(() => {
      if (videoRef.current) {
        videoRef.current.currentTime = curTime
        if (playing) videoRef.current.play().catch(() => {})
      }
    }, 80)
  }

  const togglePlay = () => {
    const v = videoRef.current
    if (!v) return
    if (v.paused) { v.play().catch(() => {}); setPlaying(true) }
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
    <div className="flex flex-col rounded-2xl border border-[var(--border)] bg-black overflow-hidden shadow-card shrink-0">
      {/* Player Header */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 px-4 py-2.5 border-b border-[var(--border)] bg-[var(--bg-panel)]">
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[var(--accent)] text-white text-xs font-bold shadow-sm">
            ▶
          </span>
          <div>
            <p className="font-bold text-xs text-[var(--text-primary)] truncate max-w-xs">{title}</p>
          </div>
        </div>

        {/* Stream Mode Switcher */}
        <div className="flex items-center gap-2">
          {hasAnnotated && (
            <div className="flex items-center p-0.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border)]">
              <button
                onClick={() => handleToggleStream('annotated')}
                className={clsx(
                  'flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all',
                  streamMode === 'annotated'
                    ? 'bg-[var(--accent)] text-white shadow-sm'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                )}
              >
                <span>🎯</span>
                <span>YOLO Detection Boxes</span>
              </button>
              <button
                onClick={() => handleToggleStream('raw')}
                className={clsx(
                  'flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all',
                  streamMode === 'raw'
                    ? 'bg-[var(--accent)] text-white shadow-sm'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                )}
              >
                <span>📹</span>
                <span>Raw Feed</span>
              </button>
            </div>
          )}

          {badge && (
            <span className="hidden sm:inline-flex rounded border border-[var(--accent)]/30 bg-[var(--accent-light)] px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase text-[var(--accent)]">
              {badge}
            </span>
          )}
        </div>
      </div>

      {/* Video Viewport */}
      <div className="relative bg-black aspect-video flex items-center justify-center max-h-[380px]">
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
          <div className="flex h-full items-center justify-center text-[var(--text-muted)] p-6 text-center">
            <p className="text-xs font-semibold">Video preview standing by...</p>
          </div>
        )}

        {/* Play Overlay Button */}
        {src && !playing && (
          <button
            onClick={togglePlay}
            className="absolute inset-0 flex items-center justify-center bg-black/40 hover:bg-black/20 transition-all group"
          >
            <div className="h-14 w-14 rounded-full border border-white/20 flex items-center justify-center bg-black/70 group-hover:scale-110 transition-transform shadow-2xl backdrop-blur-sm">
              <span className="text-[var(--accent)] text-xl ml-1">▶</span>
            </div>
          </button>
        )}

        {/* Live HUD Mode indicator */}
        <div className="absolute top-2.5 right-2.5 flex items-center gap-2 pointer-events-none">
          {streamMode === 'annotated' ? (
            <span className="flex items-center gap-1.5 rounded bg-black/85 backdrop-blur-sm px-2 py-0.5 text-[9px] font-mono font-bold text-white border border-emerald-500/40">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              YOLO ACTIVE: GREEN/RED
            </span>
          ) : (
            <span className="flex items-center gap-1.5 rounded bg-black/85 backdrop-blur-sm px-2 py-0.5 text-[9px] font-mono font-bold text-white border border-white/20">
              RAW FEED
            </span>
          )}
        </div>
      </div>

      {/* Control Bar */}
      {src && (
        <div className="px-3.5 py-2.5 bg-[var(--bg-panel)] border-t border-[var(--border)] space-y-2">
          {/* Scrubber Bar */}
          <div
            className="h-2 w-full rounded-full bg-[var(--bg-surface)] cursor-pointer relative group border border-[var(--border)]"
            onClick={handleScrub}
          >
            <div
              className="h-full rounded-full bg-[var(--accent)] transition-all pointer-events-none"
              style={{ width: `${pct}%` }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 h-3.5 w-3.5 rounded-full bg-white shadow-md border-2 border-[var(--accent)] pointer-events-none transition-transform group-hover:scale-125"
              style={{ left: `${pct}%`, transform: 'translate(-50%, -50%)' }}
            />
            {children}
          </div>

          {/* Action Row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <button
                onClick={togglePlay}
                className="flex h-6 w-6 items-center justify-center rounded bg-[var(--accent)] text-white hover:opacity-90 transition-opacity text-xs"
              >
                {playing ? '⏸' : '▶'}
              </button>

              <button
                onClick={() => setMuted(!muted)}
                className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                {muted ? '🔇' : '🔊'}
              </button>

              <span className="font-mono text-xs text-[var(--text-secondary)]">
                {secondsToTs(current)} / {secondsToTs(duration)}
              </span>
            </div>

            <span className="font-mono text-[10px] text-[var(--text-muted)] hidden sm:inline">
              Click markers on timeline to jump to anomalies
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Scrubber Timeline Marker ────────────────────────────────────────────────
function TimelineMarker({ incident, duration, active, onClick }) {
  const secs  = tsToSeconds(incident.timestamp)
  const pct   = Math.min(100, Math.max(0, (secs / duration) * 100))
  const color = severityColor(incident.severity)

  return (
    <div
      className="absolute top-0 -translate-x-1/2 h-full z-10 flex items-center justify-center cursor-pointer group"
      style={{ left: `${pct}%` }}
      onClick={e => { e.stopPropagation(); onClick(incident) }}
      title={`${incident.timestamp} — ${incident.event_type?.replace(/_/g, ' ')} (${incident.severity})`}
    >
      <div
        className={clsx(
          'h-3.5 w-2 rounded-sm transition-all shadow-sm',
          active ? 'scale-150 ring-2 ring-white shadow-lg' : 'group-hover:scale-125 opacity-90'
        )}
        style={{ background: color }}
      />
    </div>
  )
}

export default function VideoPlayer() {
  const { sessionId } = useParams()
  const navigate = useNavigate()

  const [info,            setInfo]            = useState(null)
  const [loading,         setLoading]         = useState(true)
  const [error,           setError]           = useState(null)
  const [activeInc,       setActiveInc]       = useState(null)
  const [seekTo,          setSeekTo]          = useState(null)
  const [videoDuration,   setVideoDuration]   = useState(0)
  const [currentTime,     setCurrentTime]     = useState(0)
  const [streamMode,      setStreamMode]      = useState('annotated')
  const [severityFilter,  setSeverityFilter]  = useState('all')
  const [webReady,        setWebReady]        = useState(false)
  const [guideOpen,       setGuideOpen]       = useState(false)
  const [modalImage,      setModalImage]      = useState(null)

  useEffect(() => {
    fetchVideoInfo(sessionId)
      .then(d => {
        setInfo(d)
        setWebReady(d.web_ready)
        setLoading(false)
        if (d.has_annotated) {
          setStreamMode('annotated')
        } else {
          setStreamMode('raw')
        }
        if (d.timeline?.length > 0) {
          setActiveInc(d.timeline[0])
        }
      })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [sessionId])

  // Poll if transcoding
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
    if (Math.abs(tsToSeconds(nearest.timestamp) - currentTime) < 2) {
      setActiveInc(nearest)
    }
  }, [currentTime, info])

  const handleIncidentClick = useCallback((incident) => {
    setActiveInc(incident)
    const secs = tsToSeconds(incident.timestamp)
    setSeekTo(secs)
  }, [])

  const filteredTimeline = info?.timeline?.filter(
    inc => severityFilter === 'all' || inc.severity === severityFilter
  ) || []

  if (loading) return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center space-y-3">
        <Spinner size={36} />
        <p className="font-mono text-xs text-[var(--text-muted)]">Loading video analysis...</p>
      </div>
    </div>
  )

  if (error) return (
    <div className="flex h-full items-center justify-center p-6">
      <EmptyState
        icon="⚠️"
        title="Could not load video"
        sub={error}
        action={<Btn onClick={() => navigate('/sessions')}>Back to Sessions</Btn>}
      />
    </div>
  )

  const activeFrameUrl = activeInc ? getFrameUrl(activeInc.frame_url || activeInc.frame_path) : ''
  const currentVideoSrc = (streamMode === 'annotated' && info?.annotated_video_url)
    ? info.annotated_video_url
    : info?.video_url

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* ── Top Header Bar ───────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--bg-panel)] px-5 py-3 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/sessions')}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-all"
          >
            ← Archive
          </button>
          <div className="h-4 w-px bg-[var(--border)]" />
          <div>
            <h1 className="text-sm lg:text-base font-bold text-[var(--text-primary)] truncate max-w-xs sm:max-w-md">
              {info.video_name}
            </h1>
            <p className="text-[10px] font-mono text-[var(--text-muted)]">
              {info.total_incidents} Detected Anomalies · Session ID: {sessionId?.slice(0, 12)}…
            </p>
          </div>
        </div>

        <button
          onClick={() => setGuideOpen(true)}
          className="flex items-center gap-1.5 rounded-xl border border-[var(--accent)]/30 bg-[var(--accent-light)] px-3 py-1.5 text-xs font-semibold text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white transition-all shadow-sm"
        >
          <span>💡</span>
          <span className="hidden sm:inline">Bounding Box & Motion Guide</span>
          <span className="sm:hidden">Guide</span>
        </button>
      </div>

      {/* ── Main Layout: Side-by-Side Unified Dashboard ────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Column: Video Player & Motion Diagnostics (55% on xl) */}
        <div className="flex flex-col flex-1 overflow-y-auto p-4 lg:p-5 gap-4 min-w-0">
          
          {/* Surveillance Legend Pill */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] shadow-sm">
            <div className="flex items-center gap-3.5 text-xs font-mono">
              <span className="flex items-center gap-1.5 text-[var(--success)] font-semibold">
                <span className="h-2 w-2 rounded-full bg-[var(--success)]" />
                Green Box = Normal Activity
              </span>
              <span className="flex items-center gap-1.5 text-[var(--danger)] font-semibold">
                <span className="h-2 w-2 rounded-full bg-[var(--danger)]" />
                Red Box = Anomaly Alert
              </span>
            </div>
            <span className="text-[10px] font-mono text-[var(--text-muted)]">
              YOLOv8m · SEA-RAFT · Gemini
            </span>
          </div>

          {/* Video Player Component */}
          <VideoPlayerWidget
            src={currentVideoSrc}
            title={info.video_name}
            badge={streamMode === 'annotated' ? 'YOLO Annotated' : 'Raw Feed'}
            streamMode={streamMode}
            setStreamMode={setStreamMode}
            hasAnnotated={info?.has_annotated}
            seekTo={seekTo}
            onTimeUpdate={t => {
              setCurrentTime(t)
              const v = document.querySelector('video')
              if (v && v.duration) setVideoDuration(v.duration)
            }}
          >
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

          {/* Optical Flow Motion Speedometer */}
          <MotionActivityGauge
            magnitude={activeInc ? (activeInc.confidence * 12.0) : 3.2}
            isAnomaly={Boolean(activeInc)}
            dominantDirection="Outward Dispersion"
            onOpenGuide={() => setGuideOpen(true)}
          />

          {/* Multi-Agent Forensic Synthesis */}
          <Panel className="p-4">
            <SectionHeader
              icon="🤖"
              title="Forensic Narrative Summary"
              sub="Multi-agent reasoning synthesis for session"
            />
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed bg-[var(--bg-surface)] p-3.5 rounded-xl border border-[var(--border)]">
              {info.summary}
            </p>
          </Panel>
        </div>

        {/* Center-Right Column: Live Forensic Bounding Box Snapshot Inspector (fixed visible) */}
        <div className="hidden md:flex flex-col w-[340px] lg:w-[380px] shrink-0 border-l border-[var(--border)] bg-[var(--bg-surface)] overflow-y-auto p-4 gap-4">
          <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[var(--danger)] animate-pulse" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)] font-mono">
                Forensic Box Inspector
              </h2>
            </div>
            {activeFrameUrl && (
              <button
                onClick={() => setModalImage(activeFrameUrl)}
                className="text-[11px] text-[var(--accent)] hover:underline font-semibold"
              >
                Expand ↗
              </button>
            )}
          </div>

          {activeInc ? (
            <div className="space-y-3.5">
              {/* Header card */}
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-3 shadow-sm space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{eventIcon(activeInc.event_type)}</span>
                    <span className="text-xs font-bold text-[var(--text-primary)] uppercase">
                      {activeInc.event_type?.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <SeverityBadge severity={activeInc.severity} />
                </div>
                <p className="font-mono text-[11px] text-[var(--text-muted)]">
                  Captured at: <strong className="text-[var(--accent)]">{activeInc.timestamp}</strong> · Confidence: <strong>{(activeInc.confidence * 100).toFixed(0)}%</strong>
                </p>
              </div>

              {/* Red Bounding Box Snapshot */}
              <div className="space-y-1.5">
                <div
                  className="group relative rounded-xl border border-[var(--danger)]/40 bg-black overflow-hidden aspect-video cursor-pointer shadow-md"
                  onClick={() => setModalImage(activeFrameUrl)}
                >
                  {activeFrameUrl ? (
                    <img
                      src={activeFrameUrl}
                      alt={`Incident at ${activeInc.timestamp}`}
                      className="w-full h-full object-contain transition-transform group-hover:scale-105 duration-300"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[var(--text-muted)] text-xs">
                      No frame captured
                    </div>
                  )}
                  <div className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-md bg-black/85 backdrop-blur-sm px-2 py-0.5 border border-red-500/50">
                    <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                    <span className="font-mono text-[9px] font-bold text-white tracking-wider">
                      RED BOX ANNOTATED
                    </span>
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/30 transition-opacity">
                    <span className="rounded-lg bg-black/80 text-white text-xs px-2.5 py-1 font-semibold backdrop-blur-sm">
                      Click to Enlarge
                    </span>
                  </div>
                </div>
              </div>

              {/* Forensic Details */}
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-3 space-y-1.5 shadow-sm">
                <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--accent)]">
                  Forensic Behavioral Explanation
                </p>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  {activeInc.description}
                </p>
              </div>
            </div>
          ) : (
            <EmptyState
              icon="🔍"
              title="No Incident Selected"
              sub="Select an incident from the timeline to inspect its YOLO bounding box snapshot"
            />
          )}
        </div>

        {/* Right Sidebar: Timeline Incidents Feed (300px) */}
        <div className="w-[300px] lg:w-[320px] shrink-0 border-l border-[var(--border)] bg-[var(--bg-panel)] flex flex-col h-full">
          <div className="p-3.5 border-b border-[var(--border)]">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)] mb-2 font-mono">
              Timeline Incidents ({filteredTimeline.length})
            </h3>
            
            <div className="flex gap-1 flex-wrap">
              {['all', 'critical', 'high', 'medium', 'low'].map(sev => (
                <button
                  key={sev}
                  onClick={() => setSeverityFilter(sev)}
                  className={clsx(
                    'rounded-md px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider transition-all',
                    severityFilter === sev
                      ? 'bg-[var(--accent)] text-white shadow-sm'
                      : 'border border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent)]'
                  )}
                >
                  {sev}
                </button>
              ))}
            </div>
          </div>

          {/* Incident Cards list with Red Bounding Box Thumbnails */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
            {filteredTimeline.map(inc => {
              const active = activeInc?.id === inc.id
              const thumbUrl = getFrameUrl(inc.frame_url || inc.frame_path)

              return (
                <div
                  key={inc.id}
                  onClick={() => handleIncidentClick(inc)}
                  className={clsx(
                    'cursor-pointer rounded-xl border p-2.5 transition-all group overflow-hidden',
                    active
                      ? 'border-[var(--accent)] bg-[var(--accent-light)] shadow-sm'
                      : 'border-[var(--border)] bg-[var(--bg-card)] hover:border-[var(--border-accent)]'
                  )}
                >
                  <div className="flex items-start justify-between gap-1.5 mb-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-sm shrink-0">{eventIcon(inc.event_type)}</span>
                      <span className="text-xs font-bold text-[var(--text-primary)] uppercase truncate">
                        {inc.event_type?.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <SeverityBadge severity={inc.severity} />
                  </div>
                  
                  <div className="flex items-center justify-between text-[10px] font-mono text-[var(--text-muted)] mb-1.5">
                    <span className="text-[var(--accent)] font-semibold">@{inc.timestamp}</span>
                    <span>{(inc.confidence * 100).toFixed(0)}% Conf</span>
                  </div>

                  {thumbUrl && (
                    <div className="relative mb-1.5 overflow-hidden rounded-lg border border-[var(--border)] bg-black aspect-video">
                      <img
                        src={thumbUrl}
                        alt={`Incident at ${inc.timestamp}`}
                        className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-300"
                      />
                      <div className="absolute bottom-1 left-1 flex items-center gap-1 rounded bg-black/85 px-1 py-0.5 border border-red-500/50">
                        <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                        <span className="font-mono text-[8px] font-bold text-white">RED BOX</span>
                      </div>
                    </div>
                  )}

                  <p className="text-[10px] text-[var(--text-secondary)] line-clamp-2 leading-relaxed">
                    {inc.description}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Frame Fullscreen Modal */}
      {modalImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
          onClick={() => setModalImage(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] overflow-hidden shadow-2xl p-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-[var(--border)]">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
                <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider font-mono">
                  Full Resolution Forensic Inspection · Red Bounding Box Active
                </h3>
              </div>
              <button
                onClick={() => setModalImage(null)}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--border)] text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                ✕
              </button>
            </div>
            <img
              src={modalImage}
              alt="High resolution forensic detection"
              className="max-h-[75vh] w-full object-contain rounded-lg border border-[var(--border)]"
            />
          </div>
        </div>
      )}

      {/* Guide Modal */}
      <MotionGuideModal isOpen={guideOpen} onClose={() => setGuideOpen(false)} />
    </div>
  )
}