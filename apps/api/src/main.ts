import { NestFactory } from '@nestjs/core'
import { ValidationPipe, Logger } from '@nestjs/common'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { AppModule } from './app.module'

/**
 * Application bootstrap.
 *
 * Wires the global validation pipeline, a normalized error envelope, CORS,
 * an OpenAPI document served at /docs, and starts the HTTP listener.
 *
 * Only the two values needed at the very start of boot — `API_PORT` and
 * `CORS_ORIGIN` — are read inline here (with defaults), because this runs
 * before `ConfigModule` has had a chance to load `.env`. The full typed
 * config in `src/config/index.ts` is available to services once the DI
 * container is up.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule)

  // Global DTO validation: strip unknown fields, coerce payloads to typed
  // instances, and reject anything not declared on the DTO. (An equivalent
  // pipe is also registered via APP_PIPE in AppModule for DI-integrated use.)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  )

  // CORS — origins are configurable so the web app and other frontends can
  // talk to the API from a different origin.
  const corsOrigin = process.env.CORS_ORIGIN ?? '*'
  app.enableCors({
    origin: corsOrigin === '*' ? true : corsOrigin.split(',').map((o) => o.trim()),
    credentials: true,
  })

  // OpenAPI / Swagger specification, served at /docs.
  const swaggerConfig = new DocumentBuilder()
    .setTitle('PBX Control Plane API')
    .setDescription(
      'Multi-tenant PBX/UC platform control plane. All tenant-scoped ' +
        'endpoints are isolated by the authenticated user\'s tenant_id.',
    )
    .setVersion('0.1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', name: 'Authorization' },
      'access-token',
    )
    .build()
  const document = SwaggerModule.createDocument(app, swaggerConfig)
  SwaggerModule.setup('/docs', app, document)

  const port = parseInt(process.env.API_PORT ?? '4000', 10)
  await app.listen(port)
  Logger.log(`🚀 PBX API listening on http://0.0.0.0:${port}`, 'Bootstrap')
  Logger.log(`📚 OpenAPI spec at http://0.0.0.0:${port}/docs`, 'Bootstrap')
}

void bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Fatal bootstrap error:', err)
  process.exit(1)
})
