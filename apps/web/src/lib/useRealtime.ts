'use client'

/**
 * Realtime event subscription for the browser.
 *
 * Connects to the API's WebSocket gateway (`/realtime`, behind Nginx at
 * `wss://<host>/api/realtime`) and fans telephony events out to subscribers.
 * The connection is a module-level singleton: any number of components can
 * subscribe without opening extra sockets, and the socket closes when the
 * last subscriber unsubscribes (e.g. navigating away).
 *
 * Auth uses the access token from localStorage as a `token` query parameter
 * — native WebSocket cannot set an Authorization header.
 */
import { useEffect, useState } from 'react'
import { getToken, DEFAULT_API_URL } from './api'

export interface LiveEvent {
  kind: string
  tenantId?: number
  callId?: string
  from?: string
  to?: string
  durationSec?: number
  status?: string
  presence?: string
  [key: string]: unknown
}

type Listener = (event: LiveEvent) => void

const listeners = new Set<Listener>()
let ws: WebSocket | null = null
let retryTimer: ReturnType<typeof setTimeout> | null = null
let backoffMs = 1_000
let stopped = true

const MAX_BACKOFF_MS = 30_000

function realtimeUrl(): string | null {
  const token = getToken()
  if (!token) return null
  const base = DEFAULT_API_URL.replace(/\/$/, '')
    .replace(/^https:\/\//, 'wss://')
    .replace(/^http:\/\//, 'ws://')
  return `${base}/realtime?token=${encodeURIComponent(token)}`
}

function notify(event: LiveEvent): void {
  for (const listener of listeners) {
    try {
      listener(event)
    } catch {
      // a broken subscriber must not kill the fan-out
    }
  }
}

function scheduleRetry(): void {
  if (stopped || retryTimer) return
  retryTimer = setTimeout(() => {
    retryTimer = null
    connect()
  }, backoffMs)
  backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS)
}

function connect(): void {
  if (stopped || ws) return
  const url = realtimeUrl()
  if (!url) return // no session yet
  let socket: WebSocket
  try {
    socket = new WebSocket(url)
  } catch {
    scheduleRetry()
    return
  }
  ws = socket

  socket.onopen = () => {
    backoffMs = 1_000
    notify({ kind: '__connected' })
  }
  socket.onmessage = (msg) => {
    try {
      const event = JSON.parse(String(msg.data)) as LiveEvent
      if (event && typeof event.kind === 'string') notify(event)
    } catch {
      // ignore malformed frames
    }
  }
  socket.onclose = () => {
    notify({ kind: '__disconnected' })
    ws = null
    if (!stopped) scheduleRetry()
  }
  socket.onerror = () => {
    // onclose fires next and handles the retry.
  }
}

/** Subscribe to live telephony events. Returns an unsubscribe function. */
export function subscribeRealtime(listener: Listener): () => void {
  listeners.add(listener)
  stopped = false
  if (!ws) connect()
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) {
      stopped = true
      if (retryTimer) {
        clearTimeout(retryTimer)
        retryTimer = null
      }
      ws?.close()
      ws = null
    }
  }
}

/**
 * React hook: the last `limit` live events plus connection state.
 * Internal control events (`__connected` / `__disconnected`) are filtered
 * out and surfaced as `isConnected`.
 */
export function useRealtimeEvents(limit = 10): { events: LiveEvent[]; isConnected: boolean } {
  const [events, setEvents] = useState<LiveEvent[]>([])
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    const off = subscribeRealtime((event) => {
      if (event.kind === '__connected') {
        setIsConnected(true)
        return
      }
      if (event.kind === '__disconnected') {
        setIsConnected(false)
        return
      }
      setEvents((prev) => [event, ...prev].slice(0, limit))
    })
    return off
  }, [limit])

  return { events, isConnected }
}
