import { registerAs } from '@nestjs/config';

export const configAuth = registerAs('auth', () => ({
  jwt: {
    jwt_secret_key: process.env.JWT_SECRET_KEY,
    access_token_lifetime: Number(
      process.env.ACCESS_TOKEN_LIFETIME || 60 * 60 * 24 * 7,
    ),
  },
}));
