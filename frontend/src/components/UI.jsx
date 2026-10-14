import { clsx } from 'clsx'
import { severityColor } from '../utils/api'

// ── Panel card ────────────────────────────────────────────────────────────────
export function Panel({ children, className, ...rest }) {
  return (
    <div
      className={clsx(
        'rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5 shadow-sm transition-all',
        className
      )}
      {...rest}
    >
      {children}
    </div>
  )
}

// ── Section header ────────────────────────────────────────────────────────────
export function SectionHeader({ icon, title, sub, action }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        {icon && (
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--accent-light)] text-[var(--accent)] text-lg shrink-0">
            {icon}
          </div>
        )}
        <div>
          <h2 className="text-base font-bold tracking-tight text-[var(--text-primary)]">
            {title}
          </h2>
          {sub && <p className="text-xs text-[var(--text-muted)] font-mono mt-0.5">{sub}</p>}
        </div>
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}

// ── Severity badge ────────────────────────────────────────────────────────────
export function SeverityBadge({ severity }) {
  const color = severityColor(severity)
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider"
      style={{ color, borderColor: color, background: `${color}18` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
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
  const { color, pulse } = map[status] || { color: 'var(--text-muted)', pulse: false }
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
    <div className="h-2 w-full rounded-full bg-[var(--bg-surface)] border border-[var(--border)] overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-300"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  )
}

// ── Stat card ─────────────────────────────────────────────────────────────────
export function StatCard({ label, value, icon, sub, accent = false, onClick }) {
  return (
    <div
      onClick={onClick}
      className={clsx(
        'rounded-xl border p-4 bg-[var(--bg-card)] transition-all shadow-sm flex items-center gap-4',
        accent ? 'border-[var(--accent)] bg-[var(--accent-light)]' : 'border-[var(--border)]',
        onClick && 'cursor-pointer hover:border-[var(--border-accent)] hover:shadow-md'
      )}
    >
      {icon && (
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl"
          style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}
        >
          {icon}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)] truncate">
          {label}
        </p>
        <p className="text-2xl font-bold tracking-tight text-[var(--text-primary)] mt-0.5">
          {value}
        </p>
        {sub && <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────
export function EmptyState({ icon = '🔍', title, sub, action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
      <span className="text-4xl opacity-50">{icon}</span>
      <p className="font-semibold text-sm text-[var(--text-primary)]">{title}</p>
      {sub && <p className="text-xs text-[var(--text-muted)] max-w-sm">{sub}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

// ── Loading spinner ───────────────────────────────────────────────────────────
export function Spinner({ size = 20 }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      className="animate-spin inline-block"
    >
      <circle cx="12" cy="12" r="10" stroke="var(--border)" strokeWidth="3" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

// ── Button ────────────────────────────────────────────────────────────────────
export function Btn({ children, onClick, variant = 'primary', disabled, className, icon, ...rest }) {
  const variants = {
    primary: 'bg-[var(--accent)] text-white hover:opacity-90 shadow-sm',
    secondary: 'border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:border-[var(--border-accent)]',
    ghost:   'border border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]',
    danger:  'border border-[var(--danger)] text-[var(--danger)] hover:bg-[var(--danger)] hover:text-white',
    success: 'bg-[var(--success)] text-white hover:opacity-90',
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold tracking-wide transition-all select-none',
        variants[variant],
        disabled && 'opacity-40 cursor-not-allowed pointer-events-none',
        className
      )}
      {...rest}
    >
      {icon && <span>{icon}</span>}
      {children}
    </button>
  )
}
