import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { clsx } from 'clsx'
import { useTheme } from '../context/ThemeContext'
import MotionGuideModal from './MotionGuideModal'

const links = [
  { to: '/',          icon: '📊',  label: 'Dashboard',   desc: 'Live security stats' },
  { to: '/upload',    icon: '📤',  label: 'Upload Video', desc: 'AI inference pipeline' },
  { to: '/sessions',  icon: '📁',  label: 'Archive',      desc: 'All recorded sessions' },
  { to: '/incidents', icon: '🚨',  label: 'Incidents',    desc: 'Filterable alert logs' },
]

export default function Sidebar() {
  const { theme, toggleTheme } = useTheme()
  const [guideOpen, setGuideOpen] = useState(false)

  return (
    <>
      <aside className="flex h-screen w-[240px] shrink-0 flex-col border-r border-[var(--border)] bg-[var(--bg-sidebar)] transition-colors z-20">
        {/* Brand Header */}
        <div className="border-b border-[var(--border)] px-5 py-5 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent)] text-white font-bold text-sm shadow-sm">
                AI
              </span>
              <h1 className="font-extrabold text-xl tracking-tight text-[var(--text-primary)]">
                AVSA
              </h1>
            </div>
            <p className="mt-1 font-mono text-[10px] tracking-wider uppercase text-[var(--text-muted)]">
              Surveillance Intelligence
            </p>
          </div>

          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-all"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>

        {/* Live System Badge */}
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-2.5 bg-[var(--bg-surface)]/60">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--success)] opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--success)]" />
            </span>
            <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[var(--success)]">
              GPU PIPELINE READY
            </span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
          {links.map(({ to, icon, label, desc }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                clsx(
                  'group flex items-center gap-3 rounded-xl px-3.5 py-3 transition-all',
                  isActive
                    ? 'bg-[var(--accent-light)] text-[var(--accent)] font-semibold shadow-sm border border-[var(--accent)]/30'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]'
                )
              }
            >
              <span className="text-lg leading-none">{icon}</span>
              <div className="min-w-0">
                <p className="text-xs font-semibold leading-none">{label}</p>
                <p className="text-[10px] text-[var(--text-muted)] mt-1 font-normal group-hover:text-[var(--text-secondary)]">
                  {desc}
                </p>
              </div>
            </NavLink>
          ))}
        </nav>

        {/* User Help & Guide Trigger */}
        <div className="p-3 border-t border-[var(--border)] space-y-2">
          <button
            onClick={() => setGuideOpen(true)}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-[var(--accent)]/30 bg-[var(--accent-light)] p-2.5 text-xs font-semibold text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white transition-all shadow-sm"
          >
            <span>💡</span>
            <span>Motion & Bounding Guide</span>
          </button>

          {/* Tech Spec Footer */}
          <div className="rounded-lg bg-[var(--bg-surface)] p-2.5 text-[10px] font-mono text-[var(--text-muted)] text-center">
            <p className="font-semibold text-[var(--text-secondary)]">YOLOv8m · SEA-RAFT · Gemini</p>
            <p className="mt-0.5">Green = Normal | Red = Alert</p>
          </div>
        </div>
      </aside>

      {/* Interactive Guide Modal */}
      <MotionGuideModal isOpen={guideOpen} onClose={() => setGuideOpen(false)} />
    </>
  )
}
