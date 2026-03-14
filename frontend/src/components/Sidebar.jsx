import { NavLink } from 'react-router-dom'
import { clsx } from 'clsx'

const links = [
  { to: '/',          icon: '⬡',  label: 'DASHBOARD'  },
  { to: '/upload',    icon: '↑',   label: 'UPLOAD'     },
  { to: '/sessions',  icon: '◈',  label: 'SESSIONS'   },
  { to: '/incidents', icon: '⚠',  label: 'INCIDENTS'  },
]

export default function Sidebar() {
  return (
    <aside className="flex h-screen w-[220px] shrink-0 flex-col border-r border-[#1a2236] bg-[#0a0d12]">
      {/* Logo */}
      <div className="border-b border-[#1a2236] px-5 py-5">
        <h1
          className="glitch font-display text-2xl tracking-[0.25em] text-[var(--accent)]"
          data-text="AVSA"
        >
          AVSA
        </h1>
        <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.2em] text-[var(--muted)]">
          Autonomous Surveillance
        </p>
      </div>

      {/* Live indicator */}
      <div className="flex items-center gap-2 border-b border-[#1a2236] px-5 py-3">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--danger)] opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--danger)]" />
        </span>
        <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--danger)]">
          LIVE MONITORING
        </span>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {links.map(({ to, icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 rounded px-3 py-2.5 font-mono text-xs tracking-widest transition-all',
                isActive
                  ? 'bg-[rgba(0,229,255,0.08)] text-[var(--accent)] border-l-2 border-[var(--accent)]'
                  : 'text-[var(--muted)] hover:text-slate-300 hover:bg-white/5'
              )
            }
          >
            <span className="text-base leading-none">{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-[#1a2236] px-5 py-4">
        <p className="font-mono text-[9px] text-[var(--muted)]">v1.0.0 · AI-POWERED</p>
        <p className="font-mono text-[9px] text-[var(--muted)] mt-0.5">
          YOLOv8 · RAFT · Gemini
        </p>
      </div>
    </aside>
  )
}
