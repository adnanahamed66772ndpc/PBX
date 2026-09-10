'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
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
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const append = useCallback((d: string) => {
    setNumber((n) => (n.length < 20 ? n + d : n))
  }, [])

  // DTMF-style key handling — physical keyboard too.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return
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

  function startCall() {
    if (!number) return
    // TODO: WebRTC/JSSIP integration connects here. Register the SIP user
    // agent against the configured PBX SIP registrar, invite `number`, and
    // wire onTrack/onSessionDescription to <audio> for two-way audio.
    setCallState('ringing')
    setTimeout(() => setCallState('connected'), 1200)
  }

  function hangup() {
    // TODO: session.terminate() via JSSIP.
    setCallState('idle')
    setMuted(false)
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

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">Softphone Dialer</h1>
        <p className="text-sm text-text-muted">Place outbound calls from your browser.</p>
      </div>

      {/* Number display */}
      <div className="rounded-md border border-border bg-surface px-4 py-6 text-center">
        <input
          type="text"
          inputMode="tel"
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          placeholder="Enter a number…"
          aria-label="Number to dial"
          className="w-full bg-transparent text-center text-2xl font-semibold text-text-primary placeholder:text-text-muted focus:outline-none"
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
            onClick={() => append(k.digit)}
            aria-label={`Key ${k.digit}${k.sub ? ` ${k.sub}` : ''}`}
            disabled={connected}
            className="flex h-16 flex-col items-center justify-center rounded-md border border-border bg-surface text-2xl font-semibold text-text-primary transition-colors hover:bg-surface-hover disabled:opacity-50"
          >
            <span>{k.digit}</span>
            {k.sub ? <span className="text-[10px] font-normal text-text-muted">{k.sub}</span> : null}
          </button>
        ))}
      </div>

      {/* Call controls */}
      <div className="grid grid-cols-3 gap-2">
        {callState === 'idle' ? (
          <Button variant="primary" fullWidth className="col-span-3" onClick={startCall} disabled={!number} aria-label="Start call">
            <PhoneIcon /> Call
          </Button>
        ) : (
          <>
            <Button
              variant={muted ? 'secondary' : 'ghost'}
              onClick={() => setMuted((m) => !m)}
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
