import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import WebSocket from 'ws';
import { POLYMARKET_PRICE_WS_URL, PRICE_PING_INTERVAL } from '@/shared/constants/polymarket.constants';
import { BtcChainlinkPriceBatchService } from './btc-chainlink-price-batch.service';
import { BtcBinancePriceBatchService } from './btc-binance-price-batch.service';

@Injectable()
export class PolymarketPriceWebSocketService implements OnModuleDestroy {
  private wsClient: WebSocket | null = null;
  private isConnected: boolean = false;
  private pingInterval: NodeJS.Timeout | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private reconnectDelay: number = 5000; // 5 seconds base delay
  private isSubscribed: boolean = false;
  private isSubscribedBinance: boolean = false;
  private currentChainlinkPrice: number | null = null; // Cache current Chainlink BTC/USD price
  private currentBinancePrice: number | null = null; // Cache current Binance BTC/USDT price

  constructor(
    private readonly priceBatchService: BtcChainlinkPriceBatchService,
    private readonly binancePriceBatchService: BtcBinancePriceBatchService,
    @InjectPinoLogger(PolymarketPriceWebSocketService.name) private readonly logger: PinoLogger,
  ) {}

  /**
   * Connect to Polymarket Price WebSocket
   */
  async connect(): Promise<void> {
    if (this.isConnected && this.wsClient?.readyState === WebSocket.OPEN) {
      this.logger.warn('⚠️ [PolymarketPriceWebSocketService] [connect] Already connected');
      return;
    }

    try {
      this.logger.info({ url: POLYMARKET_PRICE_WS_URL }, '🔄 [PolymarketPriceWebSocketService] [connect] Connecting to Price WebSocket');

      this.wsClient = new WebSocket(POLYMARKET_PRICE_WS_URL, {
        headers: {
          Origin: 'https://polymarket.com',
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
        },
      });

      this.wsClient.on('open', () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.logger.info('✅ [PolymarketPriceWebSocketService] [connect] Price WebSocket connected');

        // Start ping loop
        this.startPingLoop();

        // Subscribe to Chainlink price feed if not already subscribed
        if (!this.isSubscribed) {
          this.subscribeChainlinkPrice();
        }

        // Subscribe to Binance price feed if not already subscribed
        if (!this.isSubscribedBinance) {
          this.subscribeBinancePrice();
        }
      });

      this.wsClient.on('message', (data: WebSocket.Data) => {
        this.handleMessage(data);
      });

      this.wsClient.on('error', (error: Error) => {
        this.logger.error({ error: error.message }, '🔴 [PolymarketPriceWebSocketService] [connect] WebSocket error');
        this.isConnected = false;
      });

      this.wsClient.on('close', (code: number, reason: Buffer) => {
        this.isConnected = false;
        this.isSubscribed = false;
        this.isSubscribedBinance = false;
        this.logger.warn({ code, reason: reason.toString() }, '⚠️ [PolymarketPriceWebSocketService] [connect] WebSocket closed');

        // Stop ping loop
        this.stopPingLoop();

        // Attempt reconnection
        this.handleReconnect();
      });
    } catch (error) {
      this.logger.error({ error: error instanceof Error ? error.message : String(error) }, '🔴 [PolymarketPriceWebSocketService] [connect] Connection failed');
      this.handleReconnect();
    }
  }

  /**
   * Disconnect from Price WebSocket
   */
  async disconnect(): Promise<void> {
    if (!this.isConnected || !this.wsClient) {
      this.logger.warn('⚠️ [PolymarketPriceWebSocketService] [disconnect] Not connected');
      return;
    }

    this.logger.info('🔄 [PolymarketPriceWebSocketService] [disconnect] Disconnecting from Price WebSocket');
    this.stopPingLoop();
    this.wsClient.close();
    this.isConnected = false;
    this.isSubscribed = false;
    this.isSubscribedBinance = false;
    this.logger.info('✅ [PolymarketPriceWebSocketService] [disconnect] Price WebSocket disconnected');
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  /**
   * Get current Chainlink BTC/USD price from cache
   * @returns Current Chainlink price or null if not available
   */
  getCurrentChainlinkPrice(): number | null {
    return this.currentChainlinkPrice;
  }

  /**
   * Get current Binance BTC/USDT price from cache
   * @returns Current Binance price or null if not available
   */
  getCurrentBinancePrice(): number | null {
    return this.currentBinancePrice;
  }

  /**
   * Subscribe to Chainlink price feed
   * Topic: crypto_prices_chainlink
   * Symbol: BTC/USD (filtered in handler)
   */
  subscribeChainlinkPrice(): void {
    if (!this.wsClient || !this.isConnected) {
      this.logger.warn('⚠️ [PolymarketPriceWebSocketService] [subscribeChainlinkPrice] Not connected, cannot subscribe');
      return;
    }

    const subscribeMessage = {
      action: 'subscribe',
      subscriptions: [
        {
          topic: 'crypto_prices_chainlink',
          type: 'update',
        },
      ],
    };

    this.wsClient.send(JSON.stringify(subscribeMessage));
    this.isSubscribed = true;
    this.logger.info('✅ [PolymarketPriceWebSocketService] [subscribeChainlinkPrice] Subscribed to Chainlink price feed');
  }

  /**
   * Subscribe to Binance price feed
   * Topic: crypto_prices
   * Symbol: BTCUSDT (filtered in handler)
   */
  subscribeBinancePrice(): void {
    if (!this.wsClient || !this.isConnected) {
      this.logger.warn('⚠️ [PolymarketPriceWebSocketService] [subscribeBinancePrice] Not connected, cannot subscribe');
      return;
    }

    const subscribeMessage = {
      action: 'subscribe',
      subscriptions: [
        {
          topic: 'crypto_prices',
          type: 'update',
        },
      ],
    };

    this.wsClient.send(JSON.stringify(subscribeMessage));
    this.isSubscribedBinance = true;
    this.logger.info('✅ [PolymarketPriceWebSocketService] [subscribeBinancePrice] Subscribed to Binance price feed');
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(data: WebSocket.Data): void {
    try {
      const message = JSON.parse(data.toString());

      const msgType = message.type || '';
      const topic = message.topic || '';

      // Process Chainlink price messages
      if (topic === 'crypto_prices_chainlink') {
        this.handleChainlinkMessage(message, msgType);
      }
      // Process Binance price messages
      else if (topic === 'crypto_prices') {
        this.handleBinanceMessage(message, msgType);
      }
    } catch (error) {
      this.logger.error(
        { error: error instanceof Error ? error.message : String(error), data: data.toString().substring(0, 200) },
        '🔴 [PolymarketPriceWebSocketService] [handleMessage] Error processing message',
      );
    }
  }

  /**
   * Handle Chainlink price messages
   */
  private handleChainlinkMessage(message: any, msgType: string): void {

      // Handle "update" message (real-time price updates)
      if (msgType === 'update') {
        const payload = message.payload || {};
        const symbol = (payload.symbol || '').toLowerCase();
        const price = payload.value || 0;
        const timestamp = message.timestamp || Date.now();

        // Filter: chỉ lấy BTC/USD
        if (symbol !== 'btc/usd') {
          return;
        }

        if (symbol && price > 0) {
          // Parse timestamp (can be in milliseconds or seconds)
          const priceTimestamp = typeof timestamp === 'number' ? new Date(timestamp > 1000000000000 ? timestamp : timestamp * 1000) : new Date();

          // Update cache with current Chainlink price
          this.currentChainlinkPrice = price;

          // Save price to batch queue
          this.priceBatchService.savePrice(priceTimestamp, 'btc/usd', price).catch((error) => {
            this.logger.error(
              { symbol, price, error: error instanceof Error ? error.message : String(error) },
              '🔴 [PolymarketPriceWebSocketService] [handleChainlinkMessage] Error saving price',
            );
          });

          this.logger.debug({ symbol, price, timestamp: priceTimestamp.toISOString() }, '💰 [PolymarketPriceWebSocketService] [handleChainlinkMessage] Received Chainlink price');
        }
      }

      // Handle "subscribe" message (snapshot - có thể có nhiều data points)
      if (msgType === 'subscribe') {
        const payload = message.payload || {};
        const symbol = (payload.symbol || '').toLowerCase();
        const data = payload.data || [];
        const timestamp = message.timestamp || Date.now();

        // Filter: chỉ lấy BTC/USD
        if (symbol !== 'btc/usd') {
          return;
        }

        // Process all data points in snapshot
        let latestPrice: number | null = null;
        for (const point of data) {
          const price = point.value || 0;
          const pointTimestamp = point.timestamp || timestamp;

          if (price > 0) {
            // Parse timestamp (can be in milliseconds or seconds)
            const priceTimestamp = typeof pointTimestamp === 'number' ? new Date(pointTimestamp > 1000000000000 ? pointTimestamp : pointTimestamp * 1000) : new Date();

            // Track latest price from snapshot (last point is the most recent)
            latestPrice = price;

            // Save price to batch queue
            this.priceBatchService.savePrice(priceTimestamp, 'btc/usd', price).catch((error) => {
              this.logger.error(
                { symbol, price, error: error instanceof Error ? error.message : String(error) },
                '🔴 [PolymarketPriceWebSocketService] [handleChainlinkMessage] Error saving price from snapshot',
              );
            });
          }
        }

        // Update cache with latest Chainlink price from snapshot (last point is the most recent)
        if (latestPrice !== null) {
          this.currentChainlinkPrice = latestPrice;
        }

        this.logger.info({ symbol, points: data.length }, '📸 [PolymarketPriceWebSocketService] [handleChainlinkMessage] Received Chainlink price snapshot');
      }
  }

  /**
   * Handle Binance price messages
   */
  private handleBinanceMessage(message: any, msgType: string): void {
    // Handle "update" message (real-time price updates)
    if (msgType === 'update') {
      const payload = message.payload || {};
      const symbol = (payload.symbol || '').toLowerCase();
      const price = payload.value || 0;
      const timestamp = message.timestamp || Date.now();

      // Filter: chỉ lấy BTCUSDT
      if (symbol !== 'btcusdt') {
        return;
      }

      if (symbol && price > 0) {
        // Parse timestamp (can be in milliseconds or seconds)
        const priceTimestamp = typeof timestamp === 'number' ? new Date(timestamp > 1000000000000 ? timestamp : timestamp * 1000) : new Date();

        // Update cache with current Binance price
        this.currentBinancePrice = price;

        // Save price to batch queue
        this.binancePriceBatchService.savePrice(priceTimestamp, 'btcusdt', price).catch((error) => {
          this.logger.error(
            { symbol, price, error: error instanceof Error ? error.message : String(error) },
            '🔴 [PolymarketPriceWebSocketService] [handleBinanceMessage] Error saving price',
          );
        });

        this.logger.debug({ symbol, price, timestamp: priceTimestamp.toISOString() }, '💰 [PolymarketPriceWebSocketService] [handleBinanceMessage] Received Binance price');
      }
    }

    // Handle "subscribe" message (snapshot - có thể có nhiều data points)
    if (msgType === 'subscribe') {
      const payload = message.payload || {};
      const symbol = (payload.symbol || '').toLowerCase();
      const data = payload.data || [];
      const timestamp = message.timestamp || Date.now();

      // Filter: chỉ lấy BTCUSDT
      if (symbol !== 'btcusdt') {
        return;
      }

      // Process all data points in snapshot
      let latestPrice: number | null = null;
      for (const point of data) {
        const price = point.value || 0;
        const pointTimestamp = point.timestamp || timestamp;

        if (price > 0) {
          // Parse timestamp (can be in milliseconds or seconds)
          const priceTimestamp = typeof pointTimestamp === 'number' ? new Date(pointTimestamp > 1000000000000 ? pointTimestamp : pointTimestamp * 1000) : new Date();

          // Track latest price from snapshot (last point is the most recent)
          latestPrice = price;

          // Save price to batch queue
          this.binancePriceBatchService.savePrice(priceTimestamp, 'btcusdt', price).catch((error) => {
            this.logger.error(
              { symbol, price, error: error instanceof Error ? error.message : String(error) },
              '🔴 [PolymarketPriceWebSocketService] [handleBinanceMessage] Error saving price from snapshot',
            );
          });
        }
      }

      // Update cache with latest Binance price from snapshot (last point is the most recent)
      if (latestPrice !== null) {
        this.currentBinancePrice = latestPrice;
      }

      this.logger.info({ symbol, points: data.length }, '📸 [PolymarketPriceWebSocketService] [handleBinanceMessage] Received Binance price snapshot');
    }
  }

  /**
   * Start ping loop to keep WebSocket connection alive
   * IMPORTANT: Ping phải là JSON, không phải plain text
   */
  private startPingLoop(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }
    this.pingInterval = setInterval(() => {
      if (this.wsClient?.readyState === WebSocket.OPEN) {
        // QUAN TRỌNG: Ping phải là JSON, không phải plain text
        this.wsClient.send(JSON.stringify({ action: 'ping' }));
        this.logger.debug('Sent PING to Price WebSocket');
      }
    }, PRICE_PING_INTERVAL);
  }

  /**
   * Stop ping loop
   */
  private stopPingLoop(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Handle WebSocket reconnect logic with exponential backoff
   */
  private handleReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff
      this.logger.warn(
        { attempt: this.reconnectAttempts, maxAttempts: this.maxReconnectAttempts, delay: delay / 1000 },
        `⚠️ [PolymarketPriceWebSocketService] [handleReconnect] Reconnecting in ${delay / 1000}s...`,
      );
      setTimeout(() => this.connect(), delay);
    } else {
      this.logger.error(
        { maxAttempts: this.maxReconnectAttempts },
        '🔴 [PolymarketPriceWebSocketService] [handleReconnect] Max reconnect attempts reached, stopping reconnection.',
      );
      this.isConnected = false;
    }
  }

  /**
   * Cleanup on module destroy
   */
  async onModuleDestroy(): Promise<void> {
    this.logger.info('🔄 [PolymarketPriceWebSocketService] [onModuleDestroy] Cleaning up');
    await this.disconnect();
  }
}

