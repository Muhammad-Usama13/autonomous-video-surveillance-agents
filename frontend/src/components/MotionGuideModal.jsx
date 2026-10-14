import React from 'react'

export default function MotionGuideModal({ isOpen, onClose }) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div 
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] p-6 shadow-2xl transition-all"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-4 mb-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-light)] text-xl text-[var(--accent)]">
              💡
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-[var(--text-primary)]">
                Surveillance AI Guide: How It Works
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                Plain-English explanation of Bounding Boxes and Optical Flow motion tracking
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Section 1: Bounding Box Colors (Normal vs Abnormal) */}
        <div className="space-y-4">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
              <span>🎯</span>
              <span>1. AI Bounding Box Color Code</span>
            </h3>
            
            <div className="grid gap-3 sm:grid-cols-2">
              {/* Green Box */}
              <div className="flex items-start gap-3 rounded-lg border border-[var(--success)]/40 bg-[var(--success-light)] p-3">
                <div className="h-4 w-4 rounded border-2 border-[var(--success)] bg-[var(--success)]/30 mt-0.5 shrink-0" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-[var(--success)] uppercase">
                      GREEN BOX
                    </span>
                    <span className="rounded bg-[var(--success)]/20 px-1.5 py-0.2 font-mono text-[9px] text-[var(--success)]">
                      VERIFIED NORMAL
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">
                    Identifies people and vehicles behaving routinely (steady walking pace, standard density, stationary vehicles).
                  </p>
                </div>
              </div>

              {/* Red Box */}
              <div className="flex items-start gap-3 rounded-lg border border-[var(--danger)]/40 bg-[var(--danger-light)] p-3">
                <div className="h-4 w-4 rounded border-2 border-[var(--danger)] bg-[var(--danger)]/30 mt-0.5 shrink-0" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-[var(--danger)] uppercase">
                      RED BOX
                    </span>
                    <span className="rounded bg-[var(--danger)]/20 px-1.5 py-0.2 font-mono text-[9px] text-[var(--danger)]">
                      CONFIRMED ALERT
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">
                    Highlights subjects involved in detected anomalies such as panic scattering, physical altercations, sudden running, or overcrowding.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Optical Flow Made Simple */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2 flex items-center gap-2">
              <span>🌊</span>
              <span>2. Optical Flow (Motion Tracking) Made Simple</span>
            </h3>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed mb-3">
              Instead of just looking at pictures, the AI measures the <strong>speed (velocity)</strong> and <strong>direction</strong> of every moving pixel between video frames using the SEA-RAFT optical flow engine.
            </p>

            {/* Speedometer zones */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-[var(--text-muted)] mb-1">
                <span>ACTIVITY SPEEDOMETER</span>
                <span>HOW THE AI CLASSIFIES SPEED</span>
              </div>

              {/* Zone 1 */}
              <div className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] p-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--success-light)] text-[var(--success)] text-xs font-bold">
                  🟢
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-[var(--text-primary)]">
                      Calm / Normal Flow (0 – 4 px/f)
                    </p>
                    <span className="font-mono text-[10px] text-[var(--success)] font-semibold">Normal Activity</span>
                  </div>
                  <p className="text-[11px] text-[var(--text-muted)]">Pedestrians walking normally, typical background movement.</p>
                </div>
              </div>

              {/* Zone 2 */}
              <div className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] p-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--warn-light)] text-[var(--warn)] text-xs font-bold">
                  🟡
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-[var(--text-primary)]">
                      Active / Rapid Flow (4 – 8 px/f)
                    </p>
                    <span className="font-mono text-[10px] text-[var(--warn)] font-semibold">Heightened Motion</span>
                  </div>
                  <p className="text-[11px] text-[var(--text-muted)]">Brisk walking, groups converging into a crowd, sudden localized acceleration.</p>
                </div>
              </div>

              {/* Zone 3 */}
              <div className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] p-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--danger-light)] text-[var(--danger)] text-xs font-bold">
                  🔴
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-[var(--text-primary)]">
                      Surge / Violent Motion (&gt; 8 px/f)
                    </p>
                    <span className="font-mono text-[10px] text-[var(--danger)] font-semibold">Incident Trigger</span>
                  </div>
                  <p className="text-[11px] text-[var(--text-muted)]">Sprinting, panic evacuation rush, or physical fighting movements.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Automatic Camera Calibration */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1 flex items-center gap-2">
              <span>⚙️</span>
              <span>3. Smart Auto-Calibration (No Manual Tuning)</span>
            </h3>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Every video camera has a different angle, zoom, and distance. AVSA automatically observes the 
              <strong> first 20 frames</strong> of any uploaded video to learn what "peaceful motion" looks like 
              for that specific scene. You never need to configure manual motion sensitivity dials.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-5 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-lg bg-[var(--accent)] px-5 py-2 font-mono text-xs font-semibold text-white dark:text-black hover:opacity-90 transition-opacity"
          >
            Got it, close guide
          </button>
        </div>
      </div>
    </div>
  )
}
