'use client'

import { useEffect, useState, useCallback } from 'react'
import { get, setToken, getToken } from './api'
import type { SafeUser, Role } from './types'

export interface AuthState {
  user: SafeUser | null
  loading: boolean
  error: string | null
}

let cachedUser: SafeUser | null = null
let cacheExpiry = 0
const CACHE_TTL = 60_000 // 1 minute

export function useAuth(): AuthState & { refresh: () => Promise<void>; logout: () => void } {
  const [user, setUser] = useState<SafeUser | null>(cachedUser)
  const [loading, setLoading] = useState(!cachedUser)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setUser(null)
      setLoading(false)
      return
    }
    if (cachedUser && Date.now() < cacheExpiry) {
      setUser(cachedUser)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const u = await get<SafeUser>('/auth/me')
      cachedUser = u
      cacheExpiry = Date.now() + CACHE_TTL
      setUser(u)
      setError(null)
    } catch (err) {
      // 401/403 → token invalid, clear it
      if (err instanceof Error && 'status' in err) {
        const status = (err as { status: number }).status
        if (status === 401 || status === 403) {
          setToken(null)
        }
      }
      setError(err instanceof Error ? err.message : 'Failed to load user')
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  const logout = useCallback(() => {
    setToken(null)
    cachedUser = null
    cacheExpiry = 0
    setUser(null)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { user, loading, error, refresh, logout }
}

/** Role-based navigation visibility. */
export function canSeeRoute(role: Role | undefined | null, href: string): boolean {
  if (!role) return false
  if (role === 'superadmin') {
    // superadmin can see dashboard + tenants; sees tenant data only after switch
    if (href === '/tenants') return true
    return true // superadmin bypasses, sees data only if switched
  }
  if (role === 'viewer') {
    // viewer: dashboard (counts only) + settings; no dialer/contacts/voicemail/call-history
    return ['/dashboard', '/settings'].includes(href)
  }
  // admin, owner, manager, agent: full access (minus tenants management)
  if (href === '/tenants') return false
  return true
}
