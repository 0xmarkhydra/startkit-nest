import { registerAs } from '@nestjs/config';

/**
 * Parse CLICKHOUSE_URL into connection parameters
 * Format: http://host:port?user=username&password=password
 * Example: http://52.210.24.106:8173?user=polymarket&password=polymarket123
 */
const parseClickHouseUrl = (url: string) => {
  try {
    const parsedUrl = new URL(url);
    const params = new URLSearchParams(parsedUrl.search);
    
    return {
      host: parsedUrl.hostname,
      port: parsedUrl.port ? Number(parsedUrl.port) : 8123,
      username: params.get('user') || parsedUrl.username || 'default',
      password: params.get('password') || parsedUrl.password || '',
      database: parsedUrl.pathname && parsedUrl.pathname !== '/' 
        ? parsedUrl.pathname.slice(1) 
        : 'polymarket_db',
      url: url, // Keep full URL for HTTP requests
    };
  } catch (error) {
    console.log(`[⚠️] [clickhouse.config] [parseClickHouseUrl] [error]:`, error);
    return null;
  }
};

/**
 * Build ClickHouse HTTP URL with auth
 */
const buildClickHouseUrl = (
  host: string,
  port: number,
  user: string,
  password: string,
): string => {
  return `http://${host}:${port}?user=${encodeURIComponent(user)}&password=${encodeURIComponent(password)}`;
};

export const configClickHouse = registerAs('clickhouse', () => {
  // Parse CLICKHOUSE_URL if available (higher priority)
  const clickhouseUrl = process.env.CLICKHOUSE_URL;
  const parsedUrl = clickhouseUrl ? parseClickHouseUrl(clickhouseUrl) : null;

  // Default URL from user requirement
  const defaultUrl = 'http://52.210.24.106:8173?user=polymarket&password=polymarket123';

  const host = parsedUrl?.host || process.env.CLICKHOUSE_HOST || '52.210.24.106';
  const port = parsedUrl?.port || Number(process.env.CLICKHOUSE_PORT) || 8173;
  const username = parsedUrl?.username || process.env.CLICKHOUSE_USER || 'polymarket';
  const password = parsedUrl?.password || process.env.CLICKHOUSE_PASSWORD || 'polymarket123';
  const database = parsedUrl?.database || process.env.CLICKHOUSE_DATABASE || 'polymarket_db';

  const url = parsedUrl?.url || buildClickHouseUrl(host, port, username, password);

  return {
    url,
    host,
    port,
    username,
    password,
    database,
  };
});
