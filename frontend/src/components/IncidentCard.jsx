import { SeverityBadge } from './UI'
import { eventIcon, formatTs } from '../utils/api'
import { clsx } from 'clsx'

export default function IncidentCard({ incident, compact = false }) {
  const { event_type, severity, confidence, timestamp, description, frame_path, created_at } = incident

  return (
    <div
      className={clsx(
        'rounded-lg border bg-[#0e1420] transition-all hover:border-[var(--accent)]/30',
        severity === 'critical' ? 'border-[var(--danger)]/40' :
        severity === 'high'     ? 'border-[#ff6b35]/30' :
        severity === 'medium'   ? 'border-[var(--warn)]/25' :
                                  'border-[#1a2236]'
      )}
    >
      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">{eventIcon(event_type)}</span>
            <div>
              <p className="font-mono text-xs font-semibold text-slate-200 uppercase tracking-wider">
                {event_type?.replace(/_/g, ' ')}
              </p>
              <p className="font-mono text-[10px] text-[var(--muted)] mt-0.5">
                Video time: <span className="text-[var(--accent)]">{timestamp}</span>
              </p>
            </div>
          </div>
          <SeverityBadge severity={severity} />
        </div>

        {/* Description */}
        {!compact && (
          <p className="text-sm text-slate-400 leading-relaxed mb-3 border-l-2 border-[#1a2236] pl-3">
            {description}
          </p>
        )}

        {/* Meta row */}
        <div className="flex items-center justify-between text-[11px] font-mono text-[var(--muted)]">
          <span>
            Confidence:{' '}
            <span
              style={{
                color: confidence > 0.7 ? 'var(--danger)' :
                       confidence > 0.5 ? 'var(--warn)'   : 'var(--success)'
              }}
            >
              {(confidence * 100).toFixed(0)}%
            </span>
          </span>
          {created_at && (
            <span>{formatTs(created_at)}</span>
          )}
        </div>

        {/* Frame thumbnail */}
        {!compact && frame_path && (
          <div className="mt-3 overflow-hidden rounded border border-[#1a2236]">
            <img
              src={`/outputs/${frame_path.split('/outputs/').pop()}`}
              alt="Incident frame"
              className="w-full object-cover max-h-40"
              onError={e => e.target.style.display = 'none'}
            />
          </div>
        )}
      </div>
    </div>
  )
}
