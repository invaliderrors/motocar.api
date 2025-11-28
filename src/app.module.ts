import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LoanModule } from './loan/loan.module';
import { UserModule } from './user/user.module';
import { InstallmentModule } from './installment/installment.module';
import { VehicleModule } from './vehicle/vehicle.module';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { JwtAuthGuard } from './auth/guards/jwt.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { EmployeeModule } from './employee/employee.module';
import { ClosingModule } from './closing/closing.module';
import { ExpenseModule } from './expense/expense.module';
import { ReceiptModule } from './receipt/receipt.module';
import { ContractsModule } from './contracts/contracts.module';
import { WhatsappModule } from './whatsapp/whatsapp.module';
import { join } from 'path';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ScheduleModule } from '@nestjs/schedule';
import { ProvidersModule } from './providers/providers.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { PrismaModule } from './prisma/prisma.module';
import { CashFlowModule } from './cash-flow/cash-flow.module';
import { ReportsModule } from './reports/reports.module';
import { LoggerModule } from './lib/logger/logger.module';
import { LoggingInterceptor } from './lib/interceptors/logging.interceptor';
import { ActionLoggingInterceptor } from './lib/interceptors/action-logging.interceptor';
import { PermissionsModule } from './permissions/permissions.module';
import { StoreModule } from './store/store.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { NewsModule } from './news/news.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    LoggerModule,
    PrismaModule,
    AuthModule,
    PermissionsModule,
    UserModule,
    StoreModule,
    LoanModule,
    InstallmentModule,
    VehicleModule,
    AuthModule,
    EmployeeModule,
    ClosingModule,
    ExpenseModule,
    ReceiptModule,
    ContractsModule,
    WhatsappModule,
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, "..", "uploads"),
      serveRoot: "/uploads",
    }),
    ProvidersModule,
    DashboardModule,
    CashFlowModule,
    ReportsModule,
    AnalyticsModule,
    NewsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_INTERCEPTOR, useClass: ActionLoggingInterceptor },
  ],
})
export class AppModule { }
