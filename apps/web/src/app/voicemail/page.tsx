'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { get, ApiError } from '@/lib/api'
import type { Voicemail } from '@/lib/types'

function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = (sec % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

export default function VoicemailPage() {
  const [items, setItems] = useState<Voicemail[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [playingId, setPlayingId] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const data = await get<Voicemail[]>('/voicemail')
        if (!cancelled) setItems(Array.isArray(data) ? data : [])
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Failed to load voicemail.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  function togglePlay(item: Voicemail) {
    // TODO: wire to an <audio> element / streaming media from the API.
    setPlayingId((id) => (id === item.id ? null : item.id))
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">Voicemail</h1>
        <p className="text-sm text-text-muted">Listen to and triage voicemail messages.</p>
      </div>

      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}

      <ul className="flex flex-col gap-2" aria-label="Voicemail messages">
        {loading && items.length === 0 ? (
          <li className="rounded-md border border-border bg-surface px-4 py-6 text-center text-text-muted">
            Loading voicemail…
          </li>
        ) : items.length === 0 ? (
          <li className="rounded-md border border-border bg-surface px-4 py-6 text-center text-text-muted">
            No voicemail messages.
          </li>
        ) : (
          items.map((item) => {
            const isPlaying = playingId === item.id
            return (
              <li
                key={item.id}
                className={`flex items-center gap-3 rounded-md border border-border bg-surface px-4 py-3 ${
                  !item.read ? 'border-l-4 border-l-primary' : ''
                }`}
              >
                <Button
                  variant={isPlaying ? 'secondary' : 'primary'}
                  size="sm"
                  onClick={() => togglePlay(item)}
                  aria-label={isPlaying ? `Pause message from ${item.from}` : `Play message from ${item.from}`}
                  aria-pressed={isPlaying}
                >
                  {isPlaying ? 'Pause' : 'Play'}
                </Button>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-text-primary">{item.from}</span>
                    {!item.read ? (
                      <Badge variant="info" dot>New</Badge>
                    ) : (
                      <Badge variant="neutral" dot>Read</Badge>
                    )}
                  </div>
                  <p className="truncate text-xs text-text-muted">
                    {new Date(item.receivedAt).toLocaleString()} • {fmtDuration(item.durationSec)}
                  </p>
                  {item.transcription ? (
                    <p className="mt-1 line-clamp-1 text-xs text-text-muted">“{item.transcription}”</p>
                  ) : null}
                </div>
              </li>
            )
          })
        )}
      </ul>
    </div>
  )
}
