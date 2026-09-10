'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { post, setToken, DEFAULT_API_URL } from '@/lib/api'
import type { AuthLoginRequest, AuthLoginResponse } from '@/lib/types'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const body: AuthLoginRequest = { email, password }
      const res = await post<AuthLoginResponse>('/auth/login', body)
      setToken(res.accessToken)
      router.push('/dashboard')
    } catch (err) {
      const status = err instanceof Error && 'status' in err ? (err as { status: number }).status : 0
      if (status === 401) {
        setError('Invalid email or password.')
      } else if (status === 0) {
        setError(`Could not reach the API at ${DEFAULT_API_URL}.`)
      } else {
        setError(err instanceof Error ? err.message : 'Login failed.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-6 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold text-text-primary">Sign in</h1>
          <p className="mt-1 text-sm text-text-muted">PBX Console — multi-tenant telephony</p>
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <Input
            label="Email"
            type="email"
            name="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            aria-label="Email address"
          />
          <Input
            label="Password"
            type="password"
            name="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            aria-label="Password"
          />

          {error ? (
            <p role="alert" className="rounded-md border border-[var(--token-danger)]/30 bg-[var(--token-danger)]/10 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          ) : null}

          <Button type="submit" fullWidth loading={loading} aria-label="Sign in">
            Sign in
          </Button>
        </form>

        <p className="mt-4 text-center text-xs text-text-muted">
          POST {DEFAULT_API_URL}/auth/login
        </p>
      </div>
    </div>
  )
}
