const BASE = '/api'

async function req(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, opts)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Request failed')
  }
  return res.json()
}

export const api = {
  uploadVideo: (file, onProgress) => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      const fd  = new FormData()
      fd.append('file', file)
      xhr.open('POST', `${BASE}/upload`)
      if (onProgress) {
        xhr.upload.onprogress = e => {
          if (e.lengthComputable) onProgress(Math.round(e.loaded / e.total * 100))
        }
      }
      xhr.onload  = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText))
        else reject(new Error(JSON.parse(xhr.responseText)?.detail || 'Upload failed'))
      }
      xhr.onerror = () => reject(new Error('Network error'))
      xhr.send(fd)
    })
  },

  getSessions:  ()   => req('/sessions'),
  getSession:   (id) => req(`/sessions/${id}`),
  deleteSession:(id) => req(`/sessions/${id}`, { method: 'DELETE' }),

  getIncidents: (sessionId, severity) => {
    const p = new URLSearchParams()
    if (sessionId) p.set('session_id', sessionId)
    if (severity)  p.set('severity', severity)
    return req(`/incidents?${p}`)
  },
  getIncident:  (id) => req(`/incidents/${id}`),

  health: () => req('/health').catch(() => ({ status: 'offline' })),
}

export function createWS(sessionId, onMessage) {
  const protocol = location.protocol === 'https:' ? 'wss' : 'ws'
  const ws = new WebSocket(`${protocol}://${location.host}/ws/${sessionId}`)
  ws.onmessage = e => {
    try { onMessage(JSON.parse(e.data)) } catch (_) {}
  }
  ws.onerror = () => ws.close()
  return ws
}

export function severityColor(sev) {
  return {
    low:      '#00e676',
    medium:   '#ff9800',
    high:     '#ff6b35',
    critical: '#ff3d3d',
  }[sev] || '#94a3b8'
}

export function eventIcon(type) {
  return {
    crowd_panic:          '🚨',
    fight_or_aggression:  '⚔️',
    crowd_gathering:      '👥',
    overcrowding:         '🔴',
    suspicious_loitering: '👤',
    abandoned_object:     '📦',
    unusual_speed:        '💨',
    restricted_access:    '🚫',
    normal:               '✅',
  }[type] || '⚠️'
}

export function formatTs(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString()
}
