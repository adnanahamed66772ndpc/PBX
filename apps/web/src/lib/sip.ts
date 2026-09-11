/**
 * JSSIP-based softphone manager.
 *
 * Wraps JsSIP's UA + Session in a minimal event-driven API so the dialer
 * page can register, place/receive calls, send DTMF, mute, and hangup
 * without depending on JsSIP internals directly.
 *
 * Usage:
 *   const phone = createSipPhone()
 *   await phone.connect(config)       // register via WSS
 *   phone.onState(handler)            // 'connecting' | 'registered' | ...
 *   const session = phone.call(target)  // INVITE
 *   session.onState(handler)          // 'calling' | 'accepted' | 'terminated'
 *   session.toggleMute()
 *   session.hangup()
 *   phone.disconnect()
 */
import JsSIP from 'jssip'

/** The RTCSession type — extracted from UA.call()'s return type. */
type RtcSession = ReturnType<JsSIP.UA['call']>

export type SipPhoneState = 'idle' | 'connecting' | 'registered' | 'unregistered' | 'failed'

export interface SipConfig {
  extension: string
  secret: string
  domain: string
  wssUrl: string
  stunServers: string[]
  turnServers: { urls: string[]; credential?: string; username?: string }[]
}

export interface SipSessionState {
  state: 'calling' | 'accepted' | 'terminated'
  remoteNumber: string
  direction: 'out' | 'in'
}

export interface SipSession {
  state: SipSessionState['state']
  remoteNumber: string
  direction: 'out' | 'in'
  onState: (cb: (state: SipSessionState) => void) => void
  toggleMute: () => void
  isMuted: () => boolean
  hangup: () => void
  sendDtmf: (digit: string) => void
}

export interface SipPhone {
  state: SipPhoneState
  onState: (cb: (state: SipPhoneState) => void) => void
  onIncoming: (cb: (session: SipSession) => void) => void
  connect: (config: SipConfig) => Promise<void>
  disconnect: () => void
  call: (target: string) => SipSession
  isRegistered: () => boolean
}

type StateCb = (state: SipPhoneState) => void
type IncomingCb = (session: SipSession) => void

/** Extract the RTCPeerConnection from a JsSIP RTCSession. */
function getPeerConnection(rtcSession: RtcSession): RTCPeerConnection | undefined {
  const pc = (rtcSession as unknown as { sessionDescriptionHandler?: { peerConnection?: RTCPeerConnection } })
    .sessionDescriptionHandler?.peerConnection
  return pc
}

/**
 * Create a SIP phone instance backed by JsSIP.
 *
 * The UA connects to Asterisk PJSIP over WSS, registers with digest auth,
 * and exposes a thin session wrapper for call lifecycle + media.
 */
export function createSipPhone(): SipPhone {
  let ua: JsSIP.UA | null = null
  let currentState: SipPhoneState = 'idle'
  let stateCallbacks: StateCb[] = []
  let incomingCallbacks: IncomingCb[] = []
  let domain = 'localhost'
  let remoteAudio: HTMLAudioElement | null = null
  let resolveRegister: (() => void) | null = null
  let rejectRegister: ((err: Error) => void) | null = null

  function setState(s: SipPhoneState) {
    currentState = s
    for (const cb of stateCallbacks) cb(s)
  }

  function ensureRemoteAudio(): HTMLAudioElement {
    if (!remoteAudio) {
      remoteAudio = new Audio()
      remoteAudio.autoplay = true
      remoteAudio.style.display = 'none'
      document.body.appendChild(remoteAudio)
    }
    return remoteAudio
  }

  function attachRemoteStream(rtcSession: RtcSession) {
    const pc = getPeerConnection(rtcSession)
    if (pc) {
      const stream = new MediaStream()
      pc.getReceivers().forEach((r: RTCRtpReceiver) => {
        if (r.track) stream.addTrack(r.track)
      })
      const audio = ensureRemoteAudio()
      audio.srcObject = stream
      audio.play().catch(() => {})
    }
  }

  function wrapSession(
    rtcSession: RtcSession,
    remoteNumber: string,
    direction: 'out' | 'in',
  ): SipSession {
    let sessionState: SipSessionState['state'] = direction === 'in' ? 'accepted' : 'calling'
    let muted = false
    const sessionStateCallbacks: ((s: SipSessionState) => void)[] = []

    function emit() {
      for (const cb of sessionStateCallbacks) cb({
        state: sessionState,
        remoteNumber,
        direction,
      })
    }

    attachRemoteStream(rtcSession)

    const sessionObj: SipSession = {
      state: sessionState,
      remoteNumber,
      direction,
      onState(cb) {
        sessionStateCallbacks.push(cb)
      },
      toggleMute() {
        muted = !muted
        const pc = getPeerConnection(rtcSession)
        if (pc) {
          for (const s of pc.getSenders()) {
            if (s.track) s.track.enabled = !muted
          }
        }
      },
      isMuted() {
        return muted
      },
      hangup() {
        try {
          rtcSession.terminate()
        } catch {
          // already terminated
        }
      },
      sendDtmf(digit: string) {
        try {
          rtcSession.sendDTMF(digit)
        } catch {
          // DTMF not available
        }
      },
    }

    rtcSession.on('accepted', () => {
      sessionState = 'accepted'
      attachRemoteStream(rtcSession)
      emit()
    })

    rtcSession.on('confirmed', () => {
      sessionState = 'accepted'
      emit()
    })

    rtcSession.on('ended', () => {
      sessionState = 'terminated'
      emit()
    })

    rtcSession.on('failed', () => {
      sessionState = 'terminated'
      emit()
    })

    emit()
    return sessionObj
  }

  const phone: SipPhone = {
    get state() {
      return currentState
    },
    onState(cb: StateCb) {
      stateCallbacks.push(cb)
    },
    onIncoming(cb: IncomingCb) {
      incomingCallbacks.push(cb)
    },
    async connect(config: SipConfig) {
      if (ua) {
        try {
          ua.stop()
        } catch {
          // ignore
        }
      }
      setState('connecting')
      domain = config.domain

      const socket = new JsSIP.WebSocketInterface(config.wssUrl)
      const iceServers: RTCIceServer[] = [
        ...config.stunServers.map((url) => ({ urls: url })),
        ...config.turnServers.map((t) => ({
          urls: t.urls,
          ...(t.username ? { username: t.username } : {}),
          ...(t.credential ? { credential: t.credential } : {}),
        })),
      ]

      ua = new JsSIP.UA({
        uri: `sip:${config.extension}@${config.domain}`,
        password: config.secret,
        sockets: [socket],
        register: true,
        ...({ sessionTimers: false, pcConfig: { iceServers }, mediaConstraints: { audio: true, video: false } } as Record<string, unknown>),
      } as unknown as ConstructorParameters<typeof JsSIP.UA>[0])

      ua.on('registered', () => {
        setState('registered')
        if (resolveRegister) {
          resolveRegister()
          resolveRegister = null
          rejectRegister = null
        }
      })
      ua.on('unregistered', () => setState('unregistered'))
      ua.on('registrationFailed', () => {
        setState('failed')
        if (rejectRegister) {
          rejectRegister(new Error('SIP registration failed'))
          resolveRegister = null
          rejectRegister = null
        }
      })

      ua.on('newRTCSession', (evt: { session: RtcSession; originator: 'local' | 'remote' }) => {
        const rtcSession = evt.session
        const remoteNumber =
          (rtcSession.remote_identity as { uri?: { user?: string } } | undefined)?.uri?.user ?? 'unknown'
        const direction = evt.originator === 'remote' ? 'in' : 'out'

        if (direction === 'in') {
          const session = wrapSession(rtcSession, remoteNumber, 'in')
          // Auto-answer inbound calls.
          rtcSession.answer({
            mediaConstraints: { audio: true, video: false },
          })
          for (const cb of incomingCallbacks) cb(session)
        } else {
          wrapSession(rtcSession, remoteNumber, 'out')
        }
      })

      ua.start()

      return new Promise<void>((resolve, reject) => {
        resolveRegister = resolve
        rejectRegister = reject
        // Timeout after 15 seconds.
        setTimeout(() => {
          if (rejectRegister) {
            rejectRegister(new Error('SIP registration timed out'))
            resolveRegister = null
            rejectRegister = null
          }
        }, 15000)
      })
    },
    disconnect() {
      if (ua) {
        try {
          ua.stop()
        } catch {
          // ignore
        }
        ua = null
      }
      setState('idle')
    },
    call(target: string) {
      if (!ua) throw new Error('SIP UA not connected')
      const sanitizedTarget = target.replace(/[^0-9*#+]/g, '')
      const rtcSession = ua.call(`sip:${sanitizedTarget}@${domain}`, {
        mediaConstraints: { audio: true, video: false },
      })
      return wrapSession(rtcSession, sanitizedTarget, 'out')
    },
    isRegistered() {
      return currentState === 'registered'
    },
  }

  return phone
}
