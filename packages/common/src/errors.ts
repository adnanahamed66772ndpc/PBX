/** Typed application errors with HTTP-friendly status codes. */
export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number = 400,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export const Errors = {
  notFound: (resource: string) => new AppError('not_found', `${resource} not found`, 404),
  forbidden: () => new AppError('forbidden', 'insufficient permissions', 403),
  unauthorized: () => new AppError('unauthorized', 'authentication required', 401),
  conflict: (msg: string) => new AppError('conflict', msg, 409),
  validation: (msg: string, details?: Record<string, unknown>) =>
    new AppError('validation_error', msg, 422, details),
}
