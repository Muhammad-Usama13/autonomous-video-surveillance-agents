import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts'
import { api, severityColor, eventIcon } from '../utils/api'
import { useWebSocket } from '../hooks/useWebSocket'
import { useTheme } from '../context/ThemeContext'
import { Panel, StatCard, SectionHeader, SeverityBadge, EmptyState, Spinner, Btn } from '../components/UI'
import IncidentCard from '../components/IncidentCard'
import MotionGuideModal from '../components/MotionGuideModal'

const SEV_COLORS = {
  critical: '#ef4444',
  high:     '#f97316',
  medium:   '#f59e0b',
  low:      '#10b981',
}

async function fetchGpuInfo() {
  try {
    const res = await fetch('/api/gpu-info')
    return res.ok ? res.json() : null
  } catch { return null }
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { theme } = useTheme()
  const [sessions,   setSessions]   = useState([])
  const [incidents,  setIncidents]  = useState([])
  const [loading,    setLoading]    = useState(true)
  const [liveAlerts, setLiveAlerts] = useState([])
  const [gpu,        setGpu]        = useState(null)
  const [guideOpen,  setGuideOpen]  = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const [s, i] = await Promise.all([api.getSessions(), api.getIncidents()])
      setSessions(s || [])
      setIncidents(i || [])
    } catch (_) {}
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchData()
    fetchGpuInfo().then(setGpu)
    const id = setInterval(() => fetchGpuInfo().then(setGpu), 10000)
    return () => clearInterval(id)
  }, [fetchData])

  // Global WS for live alerts
  const latestSessionId = sessions[0]?.session_id
  useWebSocket(latestSessionId, msg => {
    if (msg.type === 'incident') {
      setLiveAlerts(prev => [msg.data, ...prev].slice(0, 5))
      fetchData()
    }
    if (msg.type === 'done') fetchData()
  })

  // Derived stats
  const totalSessions  = sessions.length
  const activeSessions = sessions.filter(s => s.status === 'processing').length
  const totalIncidents = incidents.length
  const criticalCount  = incidents.filter(i => i.severity === 'critical').length

  const severityData = ['critical', 'high', 'medium', 'low'].map(sev => ({
    name:  sev.toUpperCase(),
    value: incidents.filter(i => i.severity === sev).length,
    fill:  SEV_COLORS[sev],
  })).filter(d => d.value > 0)

  const eventTypeCounts = incidents.reduce((acc, inc) => {
    const k = inc.event_type || 'unknown'
    acc[k] = (acc[k] || 0) + 1
    return acc
  }, {})

  const eventBarData = Object.entries(eventTypeCounts)
    .map(([name, count]) => ({ name: name.replace(/_/g, ' '), count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  const recent = incidents.slice(0, 4)

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center space-y-3">
          <Spinner size={36} />
          <p className="font-mono text-xs text-[var(--text-muted)]">Loading dashboard data...</p>
        </div>
      </div>
    )
  }

  const isDark = theme === 'dark'
  const chartTextColor = isDark ? '#94a3b8' : '#64748b'
  const tooltipBg = isDark ? '#131b2e' : '#ffffff'
  const tooltipBorder = isDark ? '#1f2a42' : '#e2e8f0'

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-6 lg:p-8">
      {/* ── Header Row ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-[var(--text-primary)]">
              Security Control Center
            </h1>
            <span className="rounded-full bg-[var(--success-light)] px-2.5 py-0.5 text-xs font-semibold text-[var(--success)] border border-[var(--success)]/20">
              ● Online
            </span>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-1 font-mono">
            Autonomous multi-agent surveillance monitoring · Real-time inference
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setGuideOpen(true)}
            className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-4 py-2.5 text-xs font-semibold text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-all shadow-sm"
          >
            <span>💡</span>
            <span>How AI Works</span>
          </button>
          <Btn
            onClick={() => navigate('/upload')}
            variant="primary"
            icon="📤"
            className="shadow-sm"
          >
            Upload New Video
          </Btn>
        </div>
      </div>

      {/* ── How It Works Explainer Banner (User Friendly) ────────────────────── */}
      <div className="rounded-2xl border border-[var(--border)] bg-gradient-to-r from-[var(--accent-light)] via-[var(--bg-card)] to-[var(--bg-card)] p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--accent)]">
              AI SURVEILLANCE PROTOCOL
            </span>
            <h3 className="text-sm lg:text-base font-bold text-[var(--text-primary)]">
              YOLOv8 Object Tracking + SEA-RAFT Optical Flow (Motion Velocity)
            </h3>
            <p className="text-xs text-[var(--text-secondary)] max-w-2xl leading-relaxed">
              Every video is analyzed for spatial anomalies and movement surges. Review bounding box colors:
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <div className="flex items-center gap-2 rounded-xl border border-[var(--success)]/30 bg-[var(--success-light)] px-3 py-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[var(--success)]" />
              <span className="text-xs font-bold text-[var(--success)]">
                Green Box = Normal Activity
              </span>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-[var(--danger)]/30 bg-[var(--danger-light)] px-3 py-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[var(--danger)]" />
              <span className="text-xs font-bold text-[var(--danger)]">
                Red Box = Incident Alert
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Key Metrics Grid ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Total Incidents"
          value={totalIncidents}
          icon="🚨"
          sub={criticalCount > 0 ? `${criticalCount} Critical Threats` : 'Zero Critical Threats'}
          onClick={() => navigate('/incidents')}
        />
        <StatCard
          label="Active Sessions"
          value={totalSessions}
          icon="📹"
          sub={activeSessions > 0 ? `${activeSessions} Processing Now` : 'All Processing Done'}
          onClick={() => navigate('/sessions')}
        />
        <StatCard
          label="Detection Model"
          value="YOLOv8m"
          icon="👁️"
          sub="FP16 Tensor Cores"
          accent
        />
        <StatCard
          label="Motion Engine"
          value="SEA-RAFT"
          icon="🌊"
          sub="ECCV 2024 (FP32 GPU)"
        />
      </div>

      {/* ── GPU & Motion Intelligence Panels ─────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* GPU Performance Status */}
        <Panel>
          <SectionHeader
            icon="⚡"
            title="GPU Accelerator Status"
            sub={gpu?.available ? gpu.name : 'CUDA Acceleration'}
          />
          {gpu?.available ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="rounded-xl bg-[var(--bg-surface)] p-3">
                  <p className="text-[10px] font-mono text-[var(--text-muted)] uppercase">VRAM TOTAL</p>
                  <p className="text-base font-bold text-[var(--text-primary)] mt-0.5">{gpu.vram_total_gb} GB</p>
                </div>
                <div className="rounded-xl bg-[var(--bg-surface)] p-3">
                  <p className="text-[10px] font-mono text-[var(--text-muted)] uppercase">VRAM USED</p>
                  <p className="text-base font-bold text-[var(--accent)] mt-0.5">{gpu.vram_used_gb} GB</p>
                </div>
                <div className="rounded-xl bg-[var(--bg-surface)] p-3">
                  <p className="text-[10px] font-mono text-[var(--text-muted)] uppercase">PRECISION</p>
                  <p className="text-base font-bold text-[var(--success)] mt-0.5">FP16 ✓</p>
                </div>
                <div className="rounded-xl bg-[var(--bg-surface)] p-3">
                  <p className="text-[10px] font-mono text-[var(--text-muted)] uppercase">OPTICAL FLOW</p>
                  <p className="text-base font-bold text-[var(--text-primary)] mt-0.5">{gpu.flow_model || 'SEA-RAFT'}</p>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-mono text-[var(--text-muted)] mb-1.5">
                  <span>VRAM Utilization</span>
                  <span>{gpu.vram_total_gb ? Math.round((gpu.vram_used_gb / gpu.vram_total_gb) * 100) : 0}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-[var(--bg-surface)] overflow-hidden border border-[var(--border)]">
                  <div
                    className="h-full rounded-full transition-all duration-300 bg-[var(--accent)]"
                    style={{
                      width: `${gpu.vram_total_gb ? Math.round((gpu.vram_used_gb / gpu.vram_total_gb) * 100) : 0}%`
                    }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-[var(--text-muted)]">GPU acceleration offline or unallocated.</p>
          )}
        </Panel>

        {/* Layman Motion Intelligence Card */}
        <Panel>
          <SectionHeader
            icon="🌊"
            title="Optical Flow Motion Guide"
            sub="How velocity & movement patterns are interpreted"
            action={
              <button
                onClick={() => setGuideOpen(true)}
                className="text-xs text-[var(--accent)] font-semibold hover:underline"
              >
                Detailed Guide →
              </button>
            }
          />
          <div className="space-y-2.5">
            <div className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-2.5">
              <span className="text-base">🟢</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-[var(--text-primary)]">Calm Motion (&lt; 4.0 px/frame)</p>
                <p className="text-[11px] text-[var(--text-muted)]">Standard walking pace. AI keeps bounding boxes green.</p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-2.5">
              <span className="text-base">🟡</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-[var(--text-primary)]">Active Gathering (4.0 – 8.0 px/frame)</p>
                <p className="text-[11px] text-[var(--text-muted)]">Crowd clustering or quickened foot traffic.</p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-xl border border-[var(--danger)]/30 bg-[var(--danger-light)] p-2.5">
              <span className="text-base">🔴</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-[var(--danger)]">Sudden Surge (&gt; 8.0 px/frame)</p>
                <p className="text-[11px] text-[var(--text-secondary)]">Running, emergency scattering, or fight. Bounding boxes turn Red.</p>
              </div>
            </div>
          </div>
        </Panel>
      </div>

      {/* ── Charts & Incident Breakdown ──────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Incident Type Bar Chart */}
        <Panel className="lg:col-span-2">
          <SectionHeader
            icon="📊"
            title="Detected Incident Categories"
            sub="Distribution of behavior anomalies across video sessions"
          />
          {eventBarData.length > 0 ? (
            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={eventBarData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <XAxis dataKey="name" stroke={chartTextColor} fontSize={11} tickLine={false} />
                  <YAxis stroke={chartTextColor} fontSize={11} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: tooltipBg,
                      borderColor: tooltipBorder,
                      borderRadius: 12,
                      fontSize: 12,
                      color: isDark ? '#f8fafc' : '#0f172a',
                    }}
                  />
                  <Bar dataKey="count" fill="var(--accent)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState icon="📊" title="No incident data yet" sub="Upload videos to generate threat analytics" />
          )}
        </Panel>

        {/* Severity Breakdown Pie Chart */}
        <Panel>
          <SectionHeader
            icon="🍩"
            title="Threat Severity"
            sub="Critical vs Low impact events"
          />
          {severityData.length > 0 ? (
            <div className="h-60 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={severityData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {severityData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} stroke="transparent" />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: tooltipBg,
                      borderColor: tooltipBorder,
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState icon="🛡️" title="No events recorded" sub="System standing by for footage" />
          )}
        </Panel>
      </div>

      {/* ── Recent Incidents Feed ────────────────────────────────────────────── */}
      <Panel>
        <div className="flex items-center justify-between mb-4">
          <SectionHeader
            icon="🚨"
            title="Recent Incident Feed"
            sub="Confirmed behavioral alerts with Red annotated frames"
          />
          {incidents.length > 0 && (
            <Btn
              onClick={() => navigate('/incidents')}
              variant="secondary"
              className="text-xs"
            >
              View All ({incidents.length}) →
            </Btn>
          )}
        </div>

        {recent.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {recent.map(inc => (
              <IncidentCard key={inc.id} incident={inc} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon="🛡️"
            title="All clear! No incidents detected"
            sub="Footage is analyzed continuously. Anomalies with Red boxes will appear here."
            action={
              <Btn onClick={() => navigate('/upload')} variant="primary" icon="📤">
                Upload Video to Test
              </Btn>
            }
          />
        )}
      </Panel>

      {/* Guide Modal */}
      <MotionGuideModal isOpen={guideOpen} onClose={() => setGuideOpen(false)} />
    </div>
  )
}
