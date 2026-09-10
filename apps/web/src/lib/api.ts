/**
 * Typed fetch wrapper for the PBX REST API.
 *
 * - Base URL comes from NEXT_PUBLIC_API_URL (defaults to http://localhost:4000).
 * - Bearer token is attached from localStorage when present.
 * - Non-2xx responses are thrown as ApiError with the parsed JSON body so
 *   callers can surface server validation messages.
 */

const TOKEN_KEY = 'pbx.token'

export const DEFAULT_API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

export class ApiError extends Error {
  status: number
  body: unknown
  constructor(message: string, status: number, body: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string | null): void {
  if (typeof window === 'undefined') return
  if (token) window.localStorage.setItem(TOKEN_KEY, token)
  else window.localStorage.removeItem(TOKEN_KEY)
}

interface FetchOptions extends RequestInit {
  query?: Record<string, string | number | boolean | undefined | null>
}

function buildUrl(path: string, query?: FetchOptions['query']): string {
  const base = DEFAULT_API_URL.replace(/\/$/, '')
  const pathPart = path.startsWith('/') ? path : `/${path}`
  const url = `${base}${pathPart}`
  if (!query) return url
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue
    params.append(key, String(value))
  }
  const qs = params.toString()
  return qs ? `${url}?${qs}` : url
}

async function request<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { query, headers, ...rest } = options
  const token = getToken()
  const finalHeaders: Record<string, string> = {
    Accept: 'application/json',
    ...(headers as Record<string, string> | undefined),
  }
  if (token) finalHeaders.Authorization = `Bearer ${token}`

  let res: Response
  try {
    res = await fetch(buildUrl(path, query), { ...rest, headers: finalHeaders })
  } catch (err) {
    throw new ApiError(
      err instanceof Error ? err.message : 'Network request failed',
      0,
      null,
    )
  }

  if (!res.ok) {
    let body: unknown = null
    const ct = res.headers.get('content-type') ?? ''
    if (ct.includes('application/json')) {
      try {
        body = await res.json()
      } catch {
        body = null
      }
    } else {
      try {
        body = await res.text()
      } catch {
        body = null
      }
    }
    const message =
      (body && typeof body === 'object' && 'message' in body
        ? String((body as { message: unknown }).message)
        : undefined) ?? `Request failed with status ${res.status}`
    throw new ApiError(message, res.status, body)
  }

  if (res.status === 204) return undefined as T
  const contentType = res.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    return (await res.json()) as T
  }
  return (await res.text()) as unknown as T
}

export const api = {
  get: <T>(path: string, opts?: FetchOptions) => request<T>(path, { ...opts, method: 'GET' }),
  post: <T>(path: string, body?: unknown, opts?: FetchOptions) =>
    request<T>(path, {
      ...opts,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(opts?.headers ?? {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  put: <T>(path: string, body?: unknown, opts?: FetchOptions) =>
    request<T>(path, {
      ...opts,
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...(opts?.headers ?? {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  patch: <T>(path: string, body?: unknown, opts?: FetchOptions) =>
    request<T>(path, {
      ...opts,
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...(opts?.headers ?? {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  delete: <T>(path: string, opts?: FetchOptions) =>
    request<T>(path, { ...opts, method: 'DELETE' }),
  request,
  buildUrl,
  getToken,
  setToken,
}

export function get<T>(path: string, opts?: FetchOptions): Promise<T> {
  return api.get<T>(path, opts)
}

export function post<T>(path: string, body?: unknown, opts?: FetchOptions): Promise<T> {
  return api.post<T>(path, body, opts)
}

export function put<T>(path: string, body?: unknown, opts?: FetchOptions): Promise<T> {
  return api.put<T>(path, body, opts)
}

export function patch<T>(path: string, body?: unknown, opts?: FetchOptions): Promise<T> {
  return api.patch<T>(path, body, opts)
}

export function del<T>(path: string, opts?: FetchOptions): Promise<T> {
  return api.delete<T>(path, opts)
}
