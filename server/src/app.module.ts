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
import { CandidateModule } from './candidate/candidate.module';
import { NotificationsModule } from './notifications/notifications.module';
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
        PORT:       Joi.number().default(3001),
        CLIENT_URL: Joi.string().default('http://localhost:5173'),
        LLAMA_BASE_URL:    Joi.string().default('http://localhost:11434'),
        LLAMA_API_KEY:     Joi.string().optional(),
        LLAMA_MODEL:       Joi.string().default('llama3'),
        LLAMA_EMBED_MODEL: Joi.string().default('nomic-embed-text'),
        RANKING_PROVIDER:  Joi.string().valid('llama', 'heuristic').default('llama'),
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
    CandidateModule,
    NotificationsModule,
    // Feature modules added in later specs
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
