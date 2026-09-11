'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { get, patch, del, ApiError, getToken, DEFAULT_API_URL } from '@/lib/api'
import { useAuth } from '@/lib/useAuth'
import type { Voicemail } from '@/lib/types'

function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function VoicemailPage() {
  const { user } = useAuth()
  const [items, setItems] = useState<Voicemail[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [playingId, setPlayingId] = useState<number | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const objectUrlRef = useRef<string | null>(null)

  // Roles allowed to delete (mirrors the API's @Roles on DELETE /voicemail/:id).
  const canDelete = user?.role === 'superadmin' || user?.role === 'owner' || user?.role === 'admin'

  useEffect(() => {
    if (!getToken()) return
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

  // Stop playback when leaving the page.
  useEffect(() => {
    return () => {
      audioRef.current?.pause()
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    }
  }, [])

  function stopPlayback(): void {
    audioRef.current?.pause()
    audioRef.current = null
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
    setPlayingId(null)
  }

  /**
   * Play/pause a message. Recordings stream from `GET /voicemail/:id/audio`,
   * which requires a Bearer token — native <audio src> cannot send headers,
   * so we fetch the audio as a blob and play it from an object URL.
   */
  async function togglePlay(item: Voicemail): Promise<void> {
    if (playingId === item.id) {
      stopPlayback()
      return
    }
    stopPlayback()
    try {
      const token = getToken()
      const res = await fetch(`${DEFAULT_API_URL.replace(/\/$/, '')}${item.audioUrl}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) throw new ApiError(`Playback failed (${res.status})`, res.status, null)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      objectUrlRef.current = url
      const audio = new Audio(url)
      audioRef.current = audio
      audio.onended = () => stopPlayback()
      await audio.play()
      setPlayingId(item.id)

      // First listen marks the message read.
      if (!item.read) {
        setItems((prev) => prev.map((v) => (v.id === item.id ? { ...v, read: true } : v)))
        await patch(`/voicemail/${item.id}/read`, { read: true }).catch(() => {})
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Playback failed.')
      stopPlayback()
    }
  }

  async function handleDelete(item: Voicemail): Promise<void> {
    if (playingId === item.id) stopPlayback()
    try {
      await del(`/voicemail/${item.id}`)
      setItems((prev) => prev.filter((v) => v.id !== item.id))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Delete failed.')
    }
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
                  onClick={() => void togglePlay(item)}
                  aria-label={isPlaying ? `Pause message from ${item.from}` : `Play message from ${item.from}`}
                  aria-pressed={isPlaying}
                >
                  {isPlaying ? 'Pause' : 'Play'}
                </Button>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-text-primary">{item.from}</span>
                    <span className="text-xs text-text-muted">for {item.to}</span>
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

                {canDelete ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => void handleDelete(item)}
                    aria-label={`Delete message from ${item.from}`}
                  >
                    Delete
                  </Button>
                ) : null}
              </li>
            )
          })
        )}
      </ul>
    </div>
  )
}
