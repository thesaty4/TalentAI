import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import configuration from './config/configuration';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { ProjectsModule } from './projects/projects.module';
import { IrcsModule } from './ircs/ircs.module';
import { PoolModule } from './pool/pool.module';
import { EmployeesModule } from './employees/employees.module';
import { PipelineModule } from './pipeline/pipeline.module';
import { SearchModule } from './search/search.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema: Joi.object({
        DATABASE_URL: Joi.string().required(),
        JWT_SECRET:   Joi.string().min(16).required(),
        GEMINI_API_KEY: Joi.string().required(),
        PORT:         Joi.number().default(3001),
        GEMINI_MODEL: Joi.string().default('gemini-1.5-flash'),
        GEMINI_BASE_URL: Joi.string().optional(),
        CLIENT_URL:   Joi.string().default('http://localhost:5173'),
      }),
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
    ProjectsModule,
    IrcsModule,
    PoolModule,
    EmployeesModule,
    PipelineModule,
    SearchModule,
    // Feature modules added in later specs
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
