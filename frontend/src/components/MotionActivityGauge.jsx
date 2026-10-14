import React from 'react'

export default function MotionActivityGauge({ magnitude = 0, isAnomaly = false, dominantDirection = 'Eastbound', onOpenGuide }) {
  // Determine activity level based on magnitude
  let level = 'Calm (Normal)'
  let color = 'var(--success)'
  let bg = 'var(--success-light)'
  let desc = 'Regular walking speed and stationary background'
  let badgeIcon = '🟢'

  if (isAnomaly || magnitude > 8.0) {
    level = 'High Surge (Incident)'
    color = 'var(--danger)'
    bg = 'var(--danger-light)'
    desc = 'Rapid velocity surge or sudden physical movement'
    badgeIcon = '🔴'
  } else if (magnitude > 4.0) {
    level = 'Heightened Activity'
    color = 'var(--warn)'
    bg = 'var(--warn-light)'
    desc = 'Brisk movement or gathering detected'
    badgeIcon = '🟡'
  }

  // Calculate percentage for visual gauge bar (0 to 15 px/frame max)
  const pct = Math.min(100, Math.max(5, (magnitude / 15) * 100))

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4 shadow-sm transition-all">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-base">{badgeIcon}</span>
          <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
            Live Motion Intelligence
          </h4>
        </div>
        {onOpenGuide && (
          <button
            onClick={onOpenGuide}
            className="flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-surface)] px-2.5 py-1 text-[11px] font-medium text-[var(--accent)] hover:border-[var(--accent)] transition-all"
          >
            <span>💡</span>
            <span>How motion is analyzed</span>
          </button>
        )}
      </div>

      {/* Speedometer Bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center text-xs">
          <span className="text-[var(--text-muted)] font-mono text-[11px]">
            Activity Status: <strong style={{ color }}>{level}</strong>
          </span>
          <span className="font-mono text-[11px] text-[var(--text-muted)]">
            Velocity: <strong className="text-[var(--text-primary)]">{magnitude.toFixed(1)} px/f</strong>
          </span>
        </div>

        {/* Meter Bar */}
        <div className="h-2 w-full rounded-full bg-[var(--bg-surface)] border border-[var(--border)] overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${pct}%`, background: color }}
          />
        </div>
      </div>

      {/* Footer Info: Direction & Bounding Box Legend */}
      <div className="mt-3 pt-2.5 border-t border-[var(--border)] flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-3">
          <span className="text-[var(--text-muted)] text-[11px]">
            Direction: <strong className="text-[var(--text-secondary)]">{dominantDirection || 'Omnidirectional'}</strong>
          </span>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-[11px] font-mono">
          <span className="flex items-center gap-1 text-[var(--success)]">
            <span className="inline-block h-2 w-2 rounded-full bg-[var(--success)]" />
            Green = Normal
          </span>
          <span className="flex items-center gap-1 text-[var(--danger)]">
            <span className="inline-block h-2 w-2 rounded-full bg-[var(--danger)]" />
            Red = Abnormal
          </span>
        </div>
      </div>
    </div>
  )
}
