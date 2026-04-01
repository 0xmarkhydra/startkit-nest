import { registerAs } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

/**
 * Parse DATABASE_URL into connection parameters
 * Format: postgresql://username:password@host:port/database
 */
const parseDatabaseUrl = (url: string) => {
  try {
    const parsedUrl = new URL(url);
    // Decode password in case it contains URL-encoded characters like %40 for @
    const decodedPassword = decodeURIComponent(parsedUrl.password);
    
    console.log(`[🔍] [database.config] [parseDatabaseUrl] [username]:`, parsedUrl.username);
    console.log(`[🔍] [database.config] [parseDatabaseUrl] [passwordLength]:`, decodedPassword.length);
    console.log(`[🔍] [database.config] [parseDatabaseUrl] [host]:`, parsedUrl.hostname);
    console.log(`[🔍] [database.config] [parseDatabaseUrl] [database]:`, parsedUrl.pathname.slice(1));
    
    return {
      host: parsedUrl.hostname,
      port: parsedUrl.port ? Number(parsedUrl.port) : 5432,
      username: parsedUrl.username,
      password: decodedPassword,
      database: parsedUrl.pathname.slice(1), // Remove leading '/'
    };
  } catch (error) {
    console.log(`[⚠️] [database.config] [parseDatabaseUrl] [error]:`, error);
    return null;
  }
};

export const configDb = registerAs(
  'db',
  (): TypeOrmModuleOptions => {
    // Parse DATABASE_URL if available (higher priority)
    const databaseUrl = process.env.DATABASE_URL;
    const parsedUrl = databaseUrl ? parseDatabaseUrl(databaseUrl) : null;

    // For Supabase, try different SSL configurations
    const isSupabase = process.env.DATABASE_URL?.includes('supabase');
    
    console.log(`[🔍] [database.config] [configDb] [isSupabase]:`, isSupabase);
    console.log(`[🔍] [database.config] [configDb] [host]:`, parsedUrl?.host || process.env.DB_HOST || 'localhost');
    
    let sslConfig: any = false;
    let extraConfig: any = {
      max: 20,
      connectionTimeoutMillis: 10000,
    };

    if (isSupabase) {
      // For Supabase, we need SSL with specific configuration
      console.log(`[🔍] [database.config] [configDb] [sslConfig]: Configuring SSL for Supabase`);
      sslConfig = { rejectUnauthorized: false };
      
      // Alternatively, we can try different SSL modes
      extraConfig = {
        ...extraConfig,
        ssl: {
          rejectUnauthorized: false,
          require: true,
        },
      };
    }
    
    return {
      type: 'postgres',
      host: parsedUrl?.host || process.env.DB_HOST || 'localhost',
      port: parsedUrl?.port || Number(process.env.DB_PORT) || 5432,
      username: parsedUrl?.username || process.env.DB_USERNAME || 'root',
      password: parsedUrl?.password || process.env.DB_PASSWORD || 'root',
      database: parsedUrl?.database || process.env.DB_DATABASE || 'postgres',
      synchronize: true, // Auto-create tables from entities (development only)
      autoLoadEntities: true,
      logging: Boolean(Number(process.env.DB_DEBUG)) || false,
      ssl: sslConfig,
      extra: extraConfig,
    };
  },
);
