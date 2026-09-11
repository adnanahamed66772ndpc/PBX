/**
 * Minimal ARI type surface used by the call-control service.
 * These mirror the subset of Asterisk REST Interface objects we actually
 * consume: channels, bridges, stasis events and DTMF.
 *
 * The ARI client (./client.ts) parses raw JSON responses into these shapes;
 * unknown fields are tolerated and dropped, so we never need the full ARI
 * schema to stay forward-compatible.
 */

export interface AriChannel {
  id: string
  name: string
  state: ChannelState
  caller?: { number?: string; name?: string } | null
  connected?: { number?: string; name?: string } | null
  accountcode?: string | null
  dialplan: {
    context: string
    exten: string
    priority: number
    app?: string
    appData?: string
  }
  creationtime: string
  language?: string
}

export type ChannelState =
  | 'Down'
  | 'Ringing'
  | 'Up'
  | 'Busy'
  | 'Dialing'
  | 'Ring'
  | 'Hangedup'

export interface AriBridge {
  id: string
  type: string // mixing | holding
  technology: string
  bridge_class: string
  bridge_type: string
  channels: string[]
  name?: string
}

/** ARI application event envelope. `type` selects the discriminator below. */
export interface AriEvent {
  type: string
  application: string
  timestamp: string
  args?: string[]
  channel?: AriChannel
  bridge?: AriBridge
  /** Digit payload for ChannelDtmfReceived. */
  digit?: string
  /** Duration in ms for ChannelDtmfReceived. */
  duration_ms?: number
  /** Replacement channel for ChannelDestroyed/ChannelHangupRequest. */
  cause?: number
  // StasisStart carries channel + args; StasisEnd carries channel only.
}

/** Subset of ARI event types we handle in stasis.handler.ts. */
export type AriEventType =
  | 'StasisStart'
  | 'StasisEnd'
  | 'ChannelDtmfReceived'
  | 'ChannelStateChange'
  | 'ChannelHangupRequest'
  | 'ChannelDestroyed'
  | 'BridgeEnter'
  | 'BridgeLeave'
  | 'PlaybackStarted'
  | 'PlaybackFinished'

export interface OriginateParams {
  endpoint: string
  /** Dialplan extension to continue to (required when not using app/appArgs). */
  extension?: string
  context?: string
  priority?: number
  label?: string | null
  app?: string
  appArgs?: string[]
  callerId?: string
  timeout?: number
  variables?: Record<string, string>
}

/** Result of a successful channel create/originate. */
export interface OriginateResult {
  id: string
  name: string
}
