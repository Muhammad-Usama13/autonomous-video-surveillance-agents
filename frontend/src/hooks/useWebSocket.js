import { useEffect, useRef, useCallback } from 'react'
import { createWS } from '../utils/api'

/**
 * useWebSocket – connects to /ws/{sessionId} and delivers typed messages.
 *
 * onMessage receives: { type: 'progress'|'incident'|'done'|'error', data: {} }
 */
export function useWebSocket(sessionId, onMessage) {
  const wsRef   = useRef(null)
  const cbRef   = useRef(onMessage)
  cbRef.current = onMessage

  const connect = useCallback(() => {
    if (!sessionId) return
    wsRef.current?.close()
    wsRef.current = createWS(sessionId, msg => cbRef.current?.(msg))
  }, [sessionId])

  useEffect(() => {
    connect()
    return () => wsRef.current?.close()
  }, [connect])

  return { reconnect: connect }
}
