/**
 * Ambient declarations for the global WebSocket family.
 *
 * Node ≥ 22 ships an undici-backed global `WebSocket` plus its event types,
 * but @types/node does not (yet) declare them, and pulling in the DOM lib
 * would clash with @types/node's own `fetch`/`Response` globals. We declare
 * just the surface we use in src/ari/client.ts so strict typecheck passes
 * without the DOM lib and without a runtime dependency.
 *
 * These are structurally compatible with both the browser and the undici
 * implementations; only the members the client actually touches are listed.
 */

declare interface EventTargetLike {
  addEventListener(type: string, listener: (ev: any) => void): void
  removeEventListener(type: string, listener: (ev: any) => void): void
}

declare class WebSocket extends EventTargetLike {
  static readonly OPEN: number
  static readonly CLOSED: number
  constructor(url: string | URL, protocols?: string | string[] | Record<string, unknown>)
  readonly readyState: number
  close(code?: number, reason?: string): void
}

declare interface MessageEvent {
  readonly data: unknown
}

declare interface CloseEvent {
  readonly code: number
  readonly reason: string
}

declare interface Event {
  readonly type: string
}
