import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Response } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class TransformInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const res = ctx.switchToHttp().getResponse<Response>();
    return next.handle().pipe(
      map((result) => {
        if (res.headersSent) return result; // CSV already written — nothing to wrap
        // Paginated responses already carry { data, meta } — pass through
        if (result && typeof result === 'object' && 'meta' in (result as object)) {
          return result;
        }
        return { data: result };
      }),
    );
  }
}

