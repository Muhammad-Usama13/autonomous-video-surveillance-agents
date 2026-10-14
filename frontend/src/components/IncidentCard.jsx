import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SeverityBadge } from './UI'
import { eventIcon, formatTs, severityColor, getFrameUrl } from '../utils/api'
import { clsx } from 'clsx'

export default function IncidentCard({ incident, compact = false, onClick }) {
  const navigate = useNavigate()
  const [imgError, setImgError] = useState(false)
  const { event_type, severity, confidence, timestamp, description, frame_path, frame_url, created_at, session_id } = incident
  const sevColor = severityColor(severity)
  const imageUrl = getFrameUrl(frame_path || frame_url)

  const handleClick = () => {
    if (onClick) {
      onClick(incident)
    } else if (session_id) {
      navigate(`/sessions/${session_id}`)
    }
  }

  return (
    <div
      onClick={handleClick}
      className={clsx(
        'group flex flex-col justify-between rounded-xl border bg-[var(--bg-card)] transition-all overflow-hidden shadow-card hover:shadow-elev',
        severity === 'critical' ? 'border-[var(--danger)]/40 hover:border-[var(--danger)]' :
        severity === 'high'     ? 'border-orange-500/40 hover:border-orange-500' :
        severity === 'medium'   ? 'border-[var(--warn)]/40 hover:border-[var(--warn)]' :
                                  'border-[var(--border)] hover:border-[var(--accent)]',
        'cursor-pointer'
      )}
    >
      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2.5 mb-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--bg-surface)] text-xl border border-[var(--border)]">
              {eventIcon(event_type)}
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wide truncate">
                {event_type?.replace(/_/g, ' ')}
              </p>
              <p className="text-[11px] font-mono text-[var(--text-muted)]">
                Time: <strong className="text-[var(--accent)]">{timestamp}</strong>
              </p>
            </div>
          </div>
          <SeverityBadge severity={severity} />
        </div>

        {/* Description */}
        {!compact && (
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed mb-3 line-clamp-3 bg-[var(--bg-surface)] p-2.5 rounded-lg border border-[var(--border)]">
            {description}
          </p>
        )}

        {/* Frame thumbnail with Red Alert badge */}
        {!compact && imageUrl && !imgError && (
          <div className="relative mt-2 overflow-hidden rounded-lg border border-[var(--border)] bg-black aspect-video">
            <img
              src={imageUrl}
              alt={`Incident ${event_type}`}
              onError={() => setImgError(true)}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <div className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-md bg-black/80 backdrop-blur-sm px-2 py-0.5 border border-red-500/50">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
              <span className="font-mono text-[9px] font-bold text-white tracking-wider">
                RED BOX ANNOTATED
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Meta Footer */}
      <div className="px-4 py-2.5 border-t border-[var(--border)] bg-[var(--bg-surface)]/50 flex items-center justify-between text-[10px] font-mono text-[var(--text-muted)]">
        <span>
          Confidence: <strong className="text-[var(--text-primary)]">{(confidence * 100).toFixed(0)}%</strong>
        </span>
        <span className="text-[var(--accent)] font-semibold group-hover:underline">
          View in Player →
        </span>
      </div>
    </div>
  )
}
