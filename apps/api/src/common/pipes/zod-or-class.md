# Validation pipe choice

This API uses **class-validator DTOs** for request validation (via the global
`ValidationPipe` in `src/app.module.ts` and `src/main.ts`), not Zod.

Reasons:
- NestJS idiomatic: DTOs decorated with `class-validator` constraints feed
  directly into the `@nestjs/swagger` OpenAPI generation, so the spec and the
  runtime validation stay in sync from a single source of truth.
- The global `ValidationPipe` is configured with `whitelist`, `transform`, and
  `forbidNonWhitelisted`, so unknown properties are stripped/rejected and
  payloads are coerced to typed DTO instances before reaching controllers.
- Errors from class-validator are normalized by `AppExceptionFilter` into the
  `{ error: { code: 'validation_error', message, details: { errors } } }`
  envelope.

If a Zod schema is later preferred for a specific endpoint, a thin
`ZodValidationPipe` implementing `PipeTransform` can be added here and applied
per-handler; it is intentionally not introduced now to keep one validation
strategy across all modules.
