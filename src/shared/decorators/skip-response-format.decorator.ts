import { SetMetadata } from '@nestjs/common';

export const SKIP_RESPONSE_FORMAT_KEY = 'skipResponseFormat';

export const SkipResponseFormat = () =>
  SetMetadata(SKIP_RESPONSE_FORMAT_KEY, true);
