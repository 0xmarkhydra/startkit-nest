/**
 * Polymarket Collector Constants
 */

// Market timing constants (in seconds)
export const MARKET_DURATION = 900; // 15 minutes
export const OVERLAP_TIME = 30; // 30 seconds before market ends

// Monitor and interval constants (in milliseconds)
export const MONITOR_INTERVAL = 5000; // 5 seconds - check market end
export const BATCH_INTERVAL = 1000; // 1 second - batch insert interval
export const PING_INTERVAL = 10000; // 10 seconds - WebSocket ping interval

// Batch processing constants
export const BATCH_SIZE = 100; // Number of messages per batch
export const MAX_QUEUE_SIZE = 10000; // Maximum queue size to prevent overflow

// Polymarket API URLs
export const POLYMARKET_WS_URL = 'wss://ws-subscriptions-clob.polymarket.com/ws/market';
export const POLYMARKET_GAMMA_API_URL = 'https://gamma-api.polymarket.com';

// Market slug pattern
export const MARKET_SLUG_PATTERN = 'btc-updown-15m-{timestamp}';

// Event types from WebSocket
export enum WebSocketEventType {
  LAST_TRADE_PRICE = 'last_trade_price',
  PRICE_CHANGE = 'price_change',
  BOOK = 'book', // Orderbook update with bids/asks
  TRADE = 'trade', // Trade execution event
  UNKNOWN = 'unknown',
}

// Market status
export enum MarketStatus {
  ACTIVE = 'active',
  UPCOMING = 'upcoming',
  ENDED = 'ended',
  UNKNOWN = 'unknown',
}

