type Level = 'debug' | 'info' | 'warn' | 'error'

const LEVELS: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 }
const minLevel: Level = (process.env.LOG_LEVEL as Level) ?? 'info'

function ts(): string {
  return new Date().toISOString()
}

function fmt(level: Level, scope: string, msg: string, meta?: unknown): string {
  const base = `${ts()} [${level.toUpperCase()}] [${scope}] ${msg}`
  if (meta === undefined) return base
  try {
    const safe = JSON.stringify(meta)
    return `${base} ${safe}`
  } catch {
    return `${base} [unserializable]`
  }
}

/**
 * Normalises arguments to support both calling conventions:
 *   log.info('message', { meta: true })   ← canonical (msg, meta)
 *   log.info({ meta: true }, 'message')   ← pino-style (meta, msg)
 */
function normaliseArgs(first: unknown, second: unknown): { msg: string; meta?: unknown } {
  if (typeof first === 'string') {
    return { msg: first, meta: second }
  }
  return { msg: typeof second === 'string' ? second : '', meta: first }
}

export function createLogger(scope: string) {
  return {
    debug: (first: unknown, second?: unknown) => {
      const { msg, meta } = normaliseArgs(first, second)
      if (LEVELS[minLevel] <= LEVELS.debug) console.debug(fmt('debug', scope, msg, meta))
    },
    info: (first: unknown, second?: unknown) => {
      const { msg, meta } = normaliseArgs(first, second)
      if (LEVELS[minLevel] <= LEVELS.info) console.info(fmt('info', scope, msg, meta))
    },
    warn: (first: unknown, second?: unknown) => {
      const { msg, meta } = normaliseArgs(first, second)
      if (LEVELS[minLevel] <= LEVELS.warn) console.warn(fmt('warn', scope, msg, meta))
    },
    error: (first: unknown, second?: unknown) => {
      const { msg, meta } = normaliseArgs(first, second)
      console.error(fmt('error', scope, msg, meta))
    },
  }
}

export type Logger = ReturnType<typeof createLogger>
