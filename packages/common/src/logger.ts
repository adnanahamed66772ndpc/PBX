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

export function createLogger(scope: string) {
  return {
    debug: (msg: string, meta?: unknown) => {
      if (LEVELS[minLevel] <= LEVELS.debug) console.debug(fmt('debug', scope, msg, meta))
    },
    info: (msg: string, meta?: unknown) => {
      if (LEVELS[minLevel] <= LEVELS.info) console.info(fmt('info', scope, msg, meta))
    },
    warn: (msg: string, meta?: unknown) => {
      if (LEVELS[minLevel] <= LEVELS.warn) console.warn(fmt('warn', scope, msg, meta))
    },
    error: (msg: string, meta?: unknown) => {
      console.error(fmt('error', scope, msg, meta))
    },
  }
}

export type Logger = ReturnType<typeof createLogger>
