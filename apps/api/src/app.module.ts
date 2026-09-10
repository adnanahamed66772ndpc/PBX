import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_PIPE, APP_FILTER, APP_GUARD } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'

import { AppController } from './app.controller'
import { AppExceptionFilter } from './common/filters/app-exception.filter'
import { TenancyModule } from './common/tenancy/tenancy.module'
import { JwtAuthGuard } from './common/guards/jwt-auth.guard'
import { RolesGuard } from './common/guards/roles.guard'
import { AuthModule } from './modules/auth/auth.module'
import { TenantsModule } from './modules/tenants/tenants.module'
import { UsersModule } from './modules/users/users.module'
import { ExtensionsModule } from './modules/extensions/extensions.module'
import { TrunksModule } from './modules/trunks/trunks.module'
import { InboundRoutesModule } from './modules/inbound-routes/inbound-routes.module'
import { DidsModule } from './modules/dids/dids.module'
import { QueuesModule } from './modules/queues/queues.module'
import { IvrsModule } from './modules/ivrs/ivrs.module'
import { CdrModule } from './modules/cdr/cdr.module'
import { EventsModule } from './modules/events/events.module'
import { CallControlModule } from './modules/call-control/call-control.module'

/**
 * Root application module.
 *
 * ConfigModule is global so ConfigService is available everywhere without
 * per-module imports. The global ValidationPipe and AppExceptionFilter are
 * registered here so every controller gets consistent input validation and a
 * uniform error envelope without per-handler boilerplate.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TenancyModule,
    AuthModule,
    TenantsModule,
    UsersModule,
    ExtensionsModule,
    TrunksModule,
    InboundRoutesModule,
    DidsModule,
    QueuesModule,
    IvrsModule,
    CdrModule,
    EventsModule,
    CallControlModule,
  ],
  controllers: [AppController],
  providers: [
    // Global DTO validation pipeline.
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    },
    // Global normalized error envelope.
    { provide: APP_FILTER, useClass: AppExceptionFilter },
    // Global JWT guard — protects every route by default; @Public() bypasses.
    // Runs before RolesGuard so request.user is populated for RBAC checks.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
