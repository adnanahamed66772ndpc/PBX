'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { get, ApiError } from '@/lib/api'
import { createSipPhone, type SipPhone, type SipPhoneState, type SipSession, type SipConfig } from '@/lib/sip'
import type { DialerPresence } from '@/lib/types'

const KEYS: { digit: string; sub?: string }[] = [
  { digit: '1', sub: '' },
  { digit: '2', sub: 'ABC' },
  { digit: '3', sub: 'DEF' },
  { digit: '4', sub: 'GHI' },
  { digit: '5', sub: 'JKL' },
  { digit: '6', sub: 'MNO' },
  { digit: '7', sub: 'PQRS' },
  { digit: '8', sub: 'TUV' },
  { digit: '9', sub: 'WXYZ' },
  { digit: '*', sub: '' },
  { digit: '0', sub: '+' },
  { digit: '#', sub: '' },
]

const PRESENCE_OPTIONS: { value: DialerPresence; label: string; variant: 'success' | 'warning' | 'danger' | 'neutral' }[] = [
  { value: 'available', label: 'Available', variant: 'success' },
  { value: 'away', label: 'Away', variant: 'warning' },
  { value: 'dnd', label: 'Do Not Disturb', variant: 'danger' },
  { value: 'offline', label: 'Offline', variant: 'neutral' },
]

type CallState = 'idle' | 'ringing' | 'connected' | 'held'

export default function DialerPage() {
  const [number, setNumber] = useState('')
  const [callState, setCallState] = useState<CallState>('idle')
  const [muted, setMuted] = useState(false)
  const [presence, setPresence] = useState<DialerPresence>('available')
  const [duration, setDuration] = useState(0)
  const [sipState, setSipState] = useState<SipPhoneState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const phoneRef = useRef<SipPhone | null>(null)
  const sessionRef = useRef<SipSession | null>(null)

  // Initialise the SIP phone on mount — fetch config + register.
  useEffect(() => {
    let cancelled = false
    async function init() {
      try {
        const config = await get<SipConfig>('/extensions/my-sip-config')
        if (cancelled) return
        setConnecting(true)
        setError(null)
        const phone = createSipPhone()
        phoneRef.current = phone
        phone.onState((s) => setSipState(s))
        await phone.connect(config)
        if (!cancelled) setConnecting(false)
      } catch (err) {
        if (cancelled) return
        setConnecting(false)
        if (err instanceof ApiError && err.status === 404) {
          setError('No SIP extension assigned to your account. Contact an administrator.')
        } else {
          setError(err instanceof Error ? err.message : 'Failed to connect to SIP server.')
        }
      }
    }
    init()
    return () => {
      cancelled = true
      if (phoneRef.current) {
        phoneRef.current.disconnect()
        phoneRef.current = null
      }
    }
  }, [])

  // Call duration timer.
  useEffect(() => {
    if (callState === 'connected') {
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000)
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      setDuration(0)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [callState])

  const append = useCallback((d: string) => {
    setNumber((n) => (n.length < 20 ? n + d : n))
  }, [])

  // DTMF-style key handling — physical keyboard too.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return
      if (callState === 'connected') {
        // Send DTMF during a call.
        if (/^[0-9*#]$/.test(e.key)) {
          e.preventDefault()
          sessionRef.current?.sendDtmf(e.key)
        }
        return
      }
      if (/^[0-9*#]$/.test(e.key)) {
        e.preventDefault()
        append(e.key)
      } else if (e.key === 'Backspace') {
        e.preventDefault()
        setNumber((n) => n.slice(0, -1))
      } else if (e.key === 'Enter' && callState === 'idle' && number) {
        e.preventDefault()
        startCall()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [number, callState])

  function startCall() {
    if (!number || !phoneRef.current || sipState !== 'registered') return
    setError(null)
    try {
      const session = phoneRef.current.call(number)
      sessionRef.current = session
      setCallState('ringing')
      session.onState((s) => {
        if (s.state === 'accepted') {
          setCallState('connected')
        } else if (s.state === 'terminated') {
          setCallState('idle')
          setMuted(false)
          sessionRef.current = null
        }
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Call failed.')
    }
  }

  function hangup() {
    sessionRef.current?.hangup()
    sessionRef.current = null
    setCallState('idle')
    setMuted(false)
  }

  function toggleMute() {
    sessionRef.current?.toggleMute()
    setMuted((m) => !m)
  }

  function fmtDuration(sec: number): string {
    const m = Math.floor(sec / 60)
      .toString()
      .padStart(2, '0')
    const s = (sec % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  const connected = callState === 'connected'
  const presenceOpt = PRESENCE_OPTIONS.find((p) => p.value === presence)!

  const sipBadge = connecting
    ? { label: 'Connecting…', variant: 'info' as const }
    : sipState === 'registered'
      ? { label: 'Registered', variant: 'success' as const }
      : sipState === 'connecting'
        ? { label: 'Connecting…', variant: 'info' as const }
        : sipState === 'failed'
          ? { label: 'Failed', variant: 'danger' as const }
          : sipState === 'unregistered'
            ? { label: 'Unregistered', variant: 'warning' as const }
            : { label: 'Offline', variant: 'neutral' as const }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">Softphone Dialer</h1>
        <p className="text-sm text-text-muted">Place outbound calls from your browser via WebRTC.</p>
      </div>

      {/* SIP connection status */}
      <div className="flex items-center justify-between rounded-md border border-border bg-surface px-4 py-3">
        <span className="text-sm font-medium text-text-primary">SIP Status</span>
        <Badge variant={sipBadge.variant} dot>{sipBadge.label}</Badge>
      </div>

      {error ? (
        <div className="rounded-md border border-[var(--token-danger)]/30 bg-[var(--token-danger)]/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      ) : null}

      {/* Number display */}
      <div className="rounded-md border border-border bg-surface px-4 py-6 text-center">
        <input
          type="text"
          inputMode="tel"
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          placeholder="Enter a number…"
          aria-label="Number to dial"
          disabled={connected}
          className="w-full bg-transparent text-center text-2xl font-semibold text-text-primary placeholder:text-text-muted focus:outline-none disabled:opacity-50"
        />
        <div className="mt-2 h-5 text-sm text-text-muted">
          {connected ? (
            <Badge variant="success" dot>
              {fmtDuration(duration)} • {muted ? 'Muted' : 'Live'}
            </Badge>
          ) : callState === 'ringing' ? (
            <Badge variant="info" dot>Calling…</Badge>
          ) : callState === 'held' ? (
            <Badge variant="warning" dot>On Hold</Badge>
          ) : (
            <Badge variant="neutral" dot>Idle</Badge>
          )}
        </div>
      </div>

      {/* Keypad */}
      <div
        role="group"
        aria-label="Numeric keypad"
        className="grid grid-cols-3 gap-2"
      >
        {KEYS.map((k) => (
          <button
            key={k.digit}
            type="button"
            onClick={() => {
              if (connected) {
                sessionRef.current?.sendDtmf(k.digit)
              } else {
                append(k.digit)
              }
            }}
            aria-label={`Key ${k.digit}${k.sub ? ` ${k.sub}` : ''}`}
            className="flex h-16 flex-col items-center justify-center rounded-md border border-border bg-surface text-2xl font-semibold text-text-primary transition-colors hover:bg-surface-hover"
          >
            <span>{k.digit}</span>
            {k.sub ? <span className="text-[10px] font-normal text-text-muted">{k.sub}</span> : null}
          </button>
        ))}
      </div>

      {/* Call controls */}
      <div className="grid grid-cols-3 gap-2">
        {callState === 'idle' ? (
          <Button
            variant="primary"
            fullWidth
            className="col-span-3"
            onClick={startCall}
            disabled={!number || sipState !== 'registered'}
            aria-label="Start call"
          >
            <PhoneIcon /> Call
          </Button>
        ) : (
          <>
            <Button
              variant={muted ? 'secondary' : 'ghost'}
              onClick={toggleMute}
              aria-pressed={muted}
              aria-label={muted ? 'Unmute' : 'Mute'}
              disabled={!connected}
            >
              {muted ? 'Unmute' : 'Mute'}
            </Button>
            <Button
              variant={callState === 'held' ? 'secondary' : 'ghost'}
              onClick={() => setCallState((s) => (s === 'held' ? 'connected' : 'held'))}
              aria-pressed={callState === 'held'}
              aria-label={callState === 'held' ? 'Resume' : 'Hold'}
              disabled={!connected}
            >
              {callState === 'held' ? 'Resume' : 'Hold'}
            </Button>
            <Button variant="danger" onClick={hangup} aria-label="Hang up">
              Hangup
            </Button>
          </>
        )}
      </div>

      {/* Presence */}
      <div className="rounded-md border border-border bg-surface p-4">
        <div className="mb-2 flex items-center justify-between">
          <label htmlFor="dialer-presence" className="text-sm font-medium text-text-primary">
            Presence
          </label>
          <Badge variant={presenceOpt.variant} dot>{presenceOpt.label}</Badge>
        </div>
        <select
          id="dialer-presence"
          value={presence}
          onChange={(e) => setPresence(e.target.value as DialerPresence)}
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label="Set presence"
        >
          {PRESENCE_OPTIONS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
      </div>
    </div>
  )
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M22 16.92v3a2 2 0 01-2.18 2A19.79 19.79 0 0111 18.85a19.5 19.5 0 01-6-6A19.79 19.79 0 012 2.18 2 2 0 014 2h3a2 2 0 012 1.72c.13.96.36 1.9.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0122 16.92z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
