import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import type { Request, Response } from 'express'
import { AppError } from '@pbx/common'

/**
 * Normalized error envelope returned by every endpoint:
 *
 *   { error: { code, message, details? } }
 *
 * Mapping rules:
 *  - @pbx/common AppError → uses its own `status` / `code` / `details`.
 *  - Nest HttpException   → passthrough status; code derived from the reason.
 *  - everything else      → 500 'internal_error'.
 *
 * Stack traces are never included unless NODE_ENV === 'development'.
 */
@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(AppExceptionFilter.name)

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()
    const request = ctx.getRequest<Request>()
    const isDev = process.env.NODE_ENV === 'development'

    let status = HttpStatus.INTERNAL_SERVER_ERROR
    let code = 'internal_error'
    let message = 'An unexpected error occurred'
    let details: Record<string, unknown> | undefined

    if (exception instanceof AppError) {
      status = exception.status
      code = exception.code
      message = exception.message
      details = exception.details
    } else if (exception instanceof HttpException) {
      status = exception.getStatus()
      const res = exception.getResponse()
      if (typeof res === 'string') {
        message = res
        code = httpStatusToCode(status)
      } else if (typeof res === 'object' && res !== null) {
        const r = res as Record<string, unknown>
        // class-validator / ValidationPipe shape: { message: string[], error: string }
        if (Array.isArray(r['message']) && r['message'].length > 0) {
          message = (r['message'] as string[]).join(', ')
          details = { errors: r['message'] }
          code = 'validation_error'
        } else if (typeof r['message'] === 'string') {
          message = r['message']
          code = typeof r['error'] === 'string' ? (r['error'] as string) : httpStatusToCode(status)
        } else {
          message = exception.message
          code = httpStatusToCode(status)
        }
      }
    } else if (exception instanceof Error) {
      message = isDev ? exception.message : 'An unexpected error occurred'
      this.logger.error(`Unhandled error on ${request.method} ${request.url}: ${exception.message}`)
      if (isDev && exception.stack) {
        this.logger.error(exception.stack)
      }
    }

    const body: { error: { code: string; message: string; details?: Record<string, unknown> } } = {
      error: { code, message },
    }
    if (details) {
      body.error.details = details
    }

    response.status(status).json(body)
  }
}

/** Map an HTTP status to a stable, machine-readable error code. */
function httpStatusToCode(status: number): string {
  switch (status) {
    case HttpStatus.BAD_REQUEST:
      return 'bad_request'
    case HttpStatus.UNAUTHORIZED:
      return 'unauthorized'
    case HttpStatus.FORBIDDEN:
      return 'forbidden'
    case HttpStatus.NOT_FOUND:
      return 'not_found'
    case HttpStatus.CONFLICT:
      return 'conflict'
    case HttpStatus.UNPROCESSABLE_ENTITY:
      return 'validation_error'
    default:
      return 'internal_error'
  }
}
