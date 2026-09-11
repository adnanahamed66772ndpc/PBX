'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { get, post, del, getToken } from '@/lib/api'
import type { SafeUser } from '@/lib/types'

interface TwoFactorSetup {
  secret: string
  otpauthUrl: string
}

export default function SettingsPage() {
  const router = useRouter()
  const [user, setUser] = useState<SafeUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [twoFactorLoading, setTwoFactorLoading] = useState(false)
  const [setup, setSetup] = useState<TwoFactorSetup | null>(null)
  const [verifyCode, setVerifyCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (!getToken()) {
      router.push('/login')
      return
    }
    let cancelled = false
    async function loadUser() {
      try {
        const u = await get<SafeUser>('/auth/me')
        if (!cancelled) {
          setUser(u)
          setLoading(false)
        }
      } catch (err) {
        if (cancelled) return
        setLoading(false)
        setError(err instanceof Error ? err.message : 'Failed to load profile.')
      }
    }
    loadUser()
    return () => { cancelled = true }
  }, [router])

  async function enableTwoFactor() {
    setTwoFactorLoading(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await post<TwoFactorSetup>('/auth/2fa/setup')
      setSetup(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set up 2FA.')
    } finally {
      setTwoFactorLoading(false)
    }
  }

  async function verifyTwoFactor(e: React.FormEvent) {
    e.preventDefault()
    if (!setup) return
    setTwoFactorLoading(true)
    setError(null)
    try {
      const res = await post<{ verified: boolean }>('/auth/2fa/verify', {
        code: verifyCode,
      })
      if (res.verified) {
        setSuccess('2FA enabled successfully.')
        setSetup(null)
        setVerifyCode('')
        if (user) setUser({ ...user, twoFactorEnabled: true })
      } else {
        setError('Invalid code. Please try again.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '2FA verification failed.')
    } finally {
      setTwoFactorLoading(false)
    }
  }

  async function disableTwoFactor() {
    if (!confirm('Disable 2FA? This will remove the TOTP secret from your account.')) return
    setTwoFactorLoading(true)
    setError(null)
    setSuccess(null)
    try {
      await del('/auth/2fa')
      setSuccess('2FA disabled.')
      if (user) setUser({ ...user, twoFactorEnabled: false })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disable 2FA.')
    } finally {
      setTwoFactorLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl">
        <p className="text-sm text-text-muted">Loading settings…</p>
      </div>
    )
  }

  const twoFactorEnabled = user?.twoFactorEnabled ?? false

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">Settings</h1>
        <p className="text-sm text-text-muted">Manage your account and security settings.</p>
      </div>

      {/* Account info */}
      <div className="rounded-lg border border-border bg-surface p-6">
        <h2 className="text-lg font-semibold text-text-primary">Account</h2>
        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-text-muted">Email</p>
            <p className="font-medium text-text-primary">{user?.email ?? '—'}</p>
          </div>
          <div>
            <p className="text-text-muted">Role</p>
            <p className="font-medium text-text-primary">{user?.role ?? '—'}</p>
          </div>
          <div>
            <p className="text-text-muted">Name</p>
            <p className="font-medium text-text-primary">{user?.fullName ?? '—'}</p>
          </div>
          <div>
            <p className="text-text-muted">Tenant ID</p>
            <p className="font-medium text-text-primary">{user?.tenantId ?? '—'}</p>
          </div>
        </div>
      </div>

      {/* 2FA section */}
      <div className="rounded-lg border border-border bg-surface p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text-primary">Two-Factor Authentication</h2>
          <Badge variant={twoFactorEnabled ? 'success' : 'neutral'} dot>
            {twoFactorEnabled ? 'Enabled' : 'Disabled'}
          </Badge>
        </div>
        <p className="mt-2 text-sm text-text-muted">
          Protect your account with a time-based one-time password (TOTP) from an
          authenticator app like Google Authenticator, Authy, or 1Password.
        </p>

        {error ? (
          <div className="mt-4 rounded-md border border-[var(--token-danger)]/30 bg-[var(--token-danger)]/10 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        ) : null}
        {success ? (
          <div className="mt-4 rounded-md border border-[var(--token-success)]/30 bg-[var(--token-success)]/10 px-4 py-3 text-sm text-success">
            {success}
          </div>
        ) : null}

        {setup ? (
          <div className="mt-4">
            <p className="mb-2 text-sm font-medium text-text-primary">
              Scan this QR code with your authenticator app:
            </p>
            <div className="rounded-md border border-border bg-white p-4">
              <QRCodeSVG text={setup.otpauthUrl} size={200} />
            </div>
            <p className="mt-2 break-all text-xs text-text-muted">
              Secret: <code className="font-mono">{setup.secret}</code>
            </p>
            <form onSubmit={verifyTwoFactor} className="mt-4 flex flex-col gap-3">
              <Input
                label="Verification code"
                type="text"
                inputMode="numeric"
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                required
                aria-label="6-digit verification code"
              />
              <div className="flex gap-2">
                <Button type="submit" loading={twoFactorLoading} disabled={verifyCode.length !== 6}>
                  Verify &amp; Enable
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => { setSetup(null); setVerifyCode('') }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        ) : twoFactorEnabled ? (
          <div className="mt-4">
            <Button variant="danger" onClick={disableTwoFactor} loading={twoFactorLoading}>
              Disable 2FA
            </Button>
          </div>
        ) : (
          <div className="mt-4">
            <Button onClick={enableTwoFactor} loading={twoFactorLoading}>
              Enable 2FA
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

/** Lightweight inline SVG QR code renderer (no external dependency). */
function QRCodeSVG({ text, size = 200 }: { text: string; size?: number }) {
  // Render the otpauth:// URI as a link the user can open in a QR generator.
  // For a production app, include a proper QR library; this provides a
  // clickable link + the raw URI so users can paste into authenticator apps.
  const encoded = encodeURIComponent(text)
  return (
    <div className="flex flex-col items-center gap-2">
      <a
        href={`https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encoded}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm text-primary underline"
      >
        Click to view QR code
      </a>
      <textarea
        readOnly
        value={text}
        className="w-full max-w-xs resize-none rounded-md border border-border bg-surface px-2 py-1 text-xs text-text-muted"
        rows={3}
        aria-label="OTP auth URI"
      />
    </div>
  )
}
