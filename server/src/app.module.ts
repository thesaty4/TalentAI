import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import configuration from './config/configuration';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';

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
    // Feature modules added in later specs
  ],
})
export class AppModule {}
