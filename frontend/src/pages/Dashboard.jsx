import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts'
import { api, severityColor, eventIcon } from '../utils/api'
import { useWebSocket } from '../hooks/useWebSocket'
import { Panel, StatCard, SectionHeader, SeverityBadge, EmptyState, Spinner } from '../components/UI'
import IncidentCard from '../components/IncidentCard'

const SEV_COLORS = {
  critical: '#ff3d3d',
  high:     '#ff6b35',
  medium:   '#ff9800',
  low:      '#00e676',
}

async function fetchGpuInfo() {
  try {
    const res = await fetch('/api/gpu-info')
    return res.ok ? res.json() : null
  } catch { return null }
}

function GpuPanel({ gpu }) {
  if (!gpu) return null
  const usedPct = gpu.vram_total_gb
    ? Math.round((gpu.vram_used_gb / gpu.vram_total_gb) * 100)
    : 0
  return (
    <Panel className="border-[var(--accent)]/20">
      <SectionHeader icon="⚡" title="GPU STATUS" sub={gpu.available ? gpu.name : 'No GPU'} />
      {gpu.available ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'VRAM TOTAL',  val: `${gpu.vram_total_gb} GB` },
            { label: 'VRAM USED',   val: `${gpu.vram_used_gb} GB` },
            { label: 'PRECISION',   val: gpu.fp16 ? 'FP16 ✓' : 'FP32' },
            { label: 'FLOW MODEL',  val: gpu.flow_model || 'SEA-RAFT-M' },
          ].map(({ label, val }) => (
            <div key={label} className="rounded bg-[#0a0d12] p-2 text-center">
              <p className="font-mono text-[9px] text-[var(--muted)] uppercase tracking-wider">{label}</p>
              <p className="font-mono text-sm text-[var(--accent)] mt-0.5">{val}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="font-mono text-xs text-[var(--muted)]">{gpu.reason}</p>
      )}
      {gpu.available && (
        <div className="mt-3">
          <div className="flex justify-between font-mono text-[10px] text-[var(--muted)] mb-1">
            <span>VRAM Usage</span><span>{usedPct}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-[#1a2236] overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${usedPct}%`,
                background: usedPct > 80 ? 'var(--danger)' : usedPct > 60 ? 'var(--warn)' : 'var(--accent)'
              }}
            />
          </div>
        </div>
      )}
    </Panel>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [sessions,  setSessions]  = useState([])
  const [incidents, setIncidents] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [liveAlerts, setLiveAlerts] = useState([])
  const [gpu,       setGpu]       = useState(null)

  const fetchData = useCallback(async () => {
    const [s, i] = await Promise.all([api.getSessions(), api.getIncidents()])
    setSessions(s)
    setIncidents(i)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchData()
    fetchGpuInfo().then(setGpu)
    // refresh VRAM every 10 s while page is open
    const id = setInterval(() => fetchGpuInfo().then(setGpu), 10000)
    return () => clearInterval(id)
  }, [fetchData])

  // Global WS for live alerts across all sessions
  const latestSessionId = sessions[0]?.session_id
  useWebSocket(latestSessionId, msg => {
    if (msg.type === 'incident') {
      setLiveAlerts(prev => [msg.data, ...prev].slice(0, 5))
      fetchData()
    }
    if (msg.type === 'done') fetchData()
  })

  // ── Derived stats ─────────────────────────────────────────────────────
  const totalSessions   = sessions.length
  const activeSessions  = sessions.filter(s => s.status === 'processing').length
  const totalIncidents  = incidents.length
  const criticalCount   = incidents.filter(i => i.severity === 'critical').length

  const severityData = ['critical', 'high', 'medium', 'low'].map(sev => ({
    name:  sev,
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
    .slice(0, 6)

  const recent = incidents.slice(0, 4)

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner size={36} />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-5 overflow-auto p-6">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl tracking-[0.15em] text-[var(--accent)]">
            CONTROL CENTER
          </h1>
          <p className="font-mono text-[11px] text-[var(--muted)] mt-1">
            SYSTEM STATUS · {new Date().toLocaleString()}
          </p>
        </div>
        <button
          onClick={() => navigate('/upload')}
          className="rounded border border-[var(--accent)] px-5 py-2 font-mono text-xs text-[var(--accent)] hover:bg-[var(--accent)] hover:text-[var(--surface)] transition-all"
        >
          + NEW ANALYSIS
        </button>
      </div>

      {/* Live alert banner */}
      {liveAlerts.length > 0 && (
        <div className="rounded-lg border border-[var(--danger)]/50 bg-[var(--danger)]/10 px-4 py-3 flex items-center gap-3">
          <span className="animate-pulse text-[var(--danger)] text-lg">⚡</span>
          <div>
            <p className="font-mono text-xs text-[var(--danger)] font-semibold uppercase tracking-wider">
              LIVE ALERT — {liveAlerts[0].event_type?.replace(/_/g, ' ')}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">{liveAlerts[0].description}</p>
          </div>
          <span className="ml-auto font-mono text-[10px] text-[var(--danger)]">
            {liveAlerts[0].timestamp}
          </span>
        </div>
      )}

      {/* GPU status */}
      <GpuPanel gpu={gpu} />

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Sessions"    value={totalSessions}  icon="📹" />
        <StatCard label="Active Processing" value={activeSessions} icon="⚙️" accent />
        <StatCard label="Total Incidents"   value={totalIncidents} icon="⚠️" />
        <StatCard label="Critical Events"   value={criticalCount}  icon="🚨" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Bar: event types */}
        <Panel>
          <SectionHeader icon="📊" title="EVENT BREAKDOWN" />
          {eventBarData.length === 0 ? (
            <EmptyState icon="📊" title="No events yet" />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={eventBarData} margin={{ left: -20 }}>
                <XAxis
                  dataKey="name"
                  tick={{ fill: '#4a5568', fontSize: 9, fontFamily: 'JetBrains Mono' }}
                />
                <YAxis tick={{ fill: '#4a5568', fontSize: 9 }} />
                <Tooltip
                  contentStyle={{ background: '#0e1420', border: '1px solid #1a2236', fontFamily: 'JetBrains Mono', fontSize: 11 }}
                  cursor={{ fill: 'rgba(0,229,255,0.05)' }}
                />
                <Bar dataKey="count" fill="var(--accent)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>

        {/* Pie: severity */}
        <Panel>
          <SectionHeader icon="🎯" title="SEVERITY DISTRIBUTION" />
          {severityData.length === 0 ? (
            <EmptyState icon="🎯" title="No incidents yet" />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={severityData}
                  cx="50%" cy="50%"
                  innerRadius={55} outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {severityData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#0e1420', border: '1px solid #1a2236', fontFamily: 'JetBrains Mono', fontSize: 11 }}
                />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontFamily: 'JetBrains Mono', fontSize: 10, textTransform: 'uppercase' }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Panel>
      </div>

      {/* Recent incidents */}
      <Panel>
        <div className="flex items-center justify-between mb-4">
          <SectionHeader icon="🔔" title="RECENT INCIDENTS" />
          <button
            onClick={() => navigate('/incidents')}
            className="font-mono text-[10px] text-[var(--accent)] hover:underline tracking-wider"
          >
            VIEW ALL →
          </button>
        </div>
        {recent.length === 0 ? (
          <EmptyState icon="✅" title="No incidents detected" sub="Upload a video to begin analysis" />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {recent.map(inc => (
              <IncidentCard key={inc.id} incident={inc} compact />
            ))}
          </div>
        )}
      </Panel>
    </div>
  )
}
