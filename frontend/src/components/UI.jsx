import { clsx } from 'clsx'
import { severityColor } from '../utils/api'

// ── Panel card ────────────────────────────────────────────────────────────────
export function Panel({ children, className, ...rest }) {
  return (
    <div
      className={clsx(
        'rounded-lg border border-[#1a2236] bg-[#0e1420] p-4',
        className
      )}
      {...rest}
    >
      {children}
    </div>
  )
}

// ── Section header ────────────────────────────────────────────────────────────
export function SectionHeader({ icon, title, sub }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      {icon && <span className="text-[var(--accent)] text-xl">{icon}</span>}
      <div>
        <h2 className="font-display text-xl tracking-widest text-[var(--accent)]">
          {title}
        </h2>
        {sub && <p className="text-xs text-[var(--muted)] font-mono mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ── Severity badge ────────────────────────────────────────────────────────────
export function SeverityBadge({ severity }) {
  const color = severityColor(severity)
  return (
    <span
      className="inline-block rounded border px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-widest"
      style={{ color, borderColor: color, background: `${color}18` }}
    >
      {severity}
    </span>
  )
}

// ── Status dot ────────────────────────────────────────────────────────────────
export function StatusDot({ status }) {
  const map = {
    processing: { color: 'var(--warn)',    pulse: true  },
    done:       { color: 'var(--success)', pulse: false },
    error:      { color: 'var(--danger)',  pulse: false },
  }
  const { color, pulse } = map[status] || { color: 'var(--muted)', pulse: false }
  return (
    <span className="relative inline-flex h-2.5 w-2.5">
      {pulse && (
        <span
          className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
          style={{ background: color }}
        />
      )}
      <span
        className="relative inline-flex h-2.5 w-2.5 rounded-full"
        style={{ background: color }}
      />
    </span>
  )
}

// ── Progress bar ──────────────────────────────────────────────────────────────
export function ProgressBar({ value, max = 100, color = 'var(--accent)' }) {
  const pct = Math.min(100, Math.round((value / max) * 100))
  return (
    <div className="h-1.5 w-full rounded-full bg-[#1a2236] overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-300"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  )
}

// ── Stat card ─────────────────────────────────────────────────────────────────
export function StatCard({ label, value, icon, accent = false }) {
  return (
    <Panel className={clsx('flex items-center gap-4', accent && 'border-[var(--accent)]/30')}>
      {icon && (
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg"
          style={{ background: 'rgba(0,229,255,0.08)' }}
        >
          {icon}
        </div>
      )}
      <div>
        <p className="text-[11px] font-mono uppercase tracking-widest text-[var(--muted)]">{label}</p>
        <p className={clsx('text-2xl font-display tracking-wider', accent ? 'text-[var(--accent)]' : 'text-white')}>
          {value}
        </p>
      </div>
    </Panel>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────
export function EmptyState({ icon = '🔍', title, sub }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center text-[var(--muted)]">
      <span className="text-4xl opacity-40">{icon}</span>
      <p className="font-mono text-sm">{title}</p>
      {sub && <p className="text-xs opacity-60">{sub}</p>}
    </div>
  )
}

// ── Loading spinner ───────────────────────────────────────────────────────────
export function Spinner({ size = 20 }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      className="animate-spin"
    >
      <circle cx="12" cy="12" r="10" stroke="var(--border)" strokeWidth="3" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

// ── Button ────────────────────────────────────────────────────────────────────
export function Btn({ children, onClick, variant = 'primary', disabled, className, ...rest }) {
  const variants = {
    primary: 'bg-[var(--accent)] text-[var(--surface)] hover:opacity-90',
    ghost:   'border border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]',
    danger:  'border border-[var(--danger)] text-[var(--danger)] hover:bg-[var(--danger)] hover:text-white',
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        'inline-flex items-center gap-2 rounded px-4 py-2 text-sm font-mono font-semibold transition-all',
        variants[variant],
        disabled && 'opacity-40 cursor-not-allowed',
        className
      )}
      {...rest}
    >
      {children}
    </button>
  )
}
