import { TJWTPayload } from '@/shared/types';
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): TJWTPayload => {
    const request = ctx.switchToHttp().getRequest();
    // if (process.env.APP_ENV === 'local') {
    //   return {
    //     sub: 'f9fe77c1-ed02-4270-ad60-8dca99101779',
    //   };
    // }
    return (
      request?.user
    );
  },
);
