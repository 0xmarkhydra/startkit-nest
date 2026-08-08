import { SetMetadata } from '@nestjs/common';

export const SKIP_RATE_LIMIT_KEY = 'startkit:skip-rate-limit';

export const SkipRateLimit = () => SetMetadata(SKIP_RATE_LIMIT_KEY, true);
