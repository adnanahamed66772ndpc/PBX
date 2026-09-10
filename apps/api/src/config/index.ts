/**
 * Strongly-typed, read-once application configuration.
 *
 * Every module reads its values from `process.env` indirectly through this
 * object (or through NestJS ConfigService) so that the surface area of env
 * access is centralized and auditable.
 */
export interface AppConfig {
  /** PostgreSQL connection string used by @pbx/db. */
  databaseUrl: string
  /** Secret used to sign access JWTs. */
  jwtSecret: string
  /** Access token lifetime (e.g. "15m"). */
  jwtExpiresIn: string
  /** Refresh token lifetime (e.g. "30d"). */
  jwtRefreshExpiresIn: string
  /** Comma-separated list of allowed CORS origins (or "*" for all). */
  corsOrigin: string
  /** Base URL of the Asterisk ARI HTTP interface (apps/telephony). */
  ariUrl: string
  /** NATS connection URL (optional — the app boots without it). */
  natsUrl: string
  /** Port the HTTP API listens on. */
  apiPort: number
  /** True when NODE_ENV === 'development' (controls error detail leakage). */
  isDev: boolean
}

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback
  if (value === undefined || value === '') {
    // Fail loud at boot so misconfiguration is never silently swallowed.
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

/**
 * Load and freeze the application configuration from the process environment.
 * Called once during bootstrap.
 */
export function loadConfig(): AppConfig {
  const config: AppConfig = {
    databaseUrl: required('DATABASE_URL'),
    jwtSecret: required('JWT_SECRET'),
    jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '15m',
    jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '30d',
    corsOrigin: process.env.CORS_ORIGIN ?? '*',
    ariUrl: process.env.ARI_URL ?? '',
    natsUrl: process.env.NATS_URL ?? '',
    apiPort: parseInt(process.env.API_PORT ?? '4000', 10),
    isDev: process.env.NODE_ENV === 'development',
  }
  return Object.freeze(config)
}
