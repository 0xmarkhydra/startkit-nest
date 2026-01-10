import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import WebSocket from 'ws';
import { POLYMARKET_WS_URL, PING_INTERVAL, WebSocketEventType, MarketStatus } from '@/shared/constants/polymarket.constants';
import { RawMessageBatchService } from './raw-message-batch.service';
import { MarketTradeBatchService } from './market-trade-batch.service';
import { MarketPriceChangeBatchService } from './market-price-change-batch.service';
import { MarketRegistryRepository } from '@/database/repositories/market-registry.repository';
import { PolymarketPriceWebSocketService } from './polymarket-price-websocket.service';

interface AssetMarketMap {
  slug: string;
  status: MarketStatus;
  assetYesId: string;
  assetNoId: string;
}

@Injectable()
export class PolymarketWebSocketCollectorService implements OnModuleDestroy {
  private wsClient: WebSocket | null = null;
  private isConnected: boolean = false;
  private subscribedAssets: Set<string> = new Set();
  private assetToMarketMap: Map<string, AssetMarketMap> = new Map();
  private pingInterval: NodeJS.Timeout | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private reconnectDelay: number = 5000; // 5 seconds base delay

  constructor(
    private readonly batchService: RawMessageBatchService,
    private readonly tradeBatchService: MarketTradeBatchService,
    private readonly priceChangeBatchService: MarketPriceChangeBatchService,
    private readonly marketRegistry: MarketRegistryRepository,
    private readonly priceWebSocketService: PolymarketPriceWebSocketService,
    @InjectPinoLogger(PolymarketWebSocketCollectorService.name) private readonly logger: PinoLogger,
  ) {}

  /**
   * Connect to Polymarket WebSocket
   */
  async connect(): Promise<void> {
    if (this.isConnected && this.wsClient?.readyState === WebSocket.OPEN) {
      this.logger.warn('⚠️ [PolymarketWebSocketCollectorService] [connect] Already connected');
      return;
    }

    try {
      this.logger.info({ url: POLYMARKET_WS_URL }, '🔄 [PolymarketWebSocketCollectorService] [connect] Connecting to WebSocket');

      this.wsClient = new WebSocket(POLYMARKET_WS_URL);

      this.wsClient.on('open', () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.logger.info('✅ [PolymarketWebSocketCollectorService] [connect] WebSocket connected');

        // Start ping loop
        this.startPingLoop();

        // Re-subscribe to existing assets if any
        // Note: AssetMarketMap already contains assetYesId and assetNoId from previous subscription
        if (this.subscribedAssets.size > 0) {
          this.logger.info(
            { assetCount: this.subscribedAssets.size },
            '🔄 [PolymarketWebSocketCollectorService] [connect] Re-subscribing to existing assets',
          );
          // Re-subscribe all assets - AssetMarketMap already has the data
          const allAssets = Array.from(this.subscribedAssets);
          const subscribeMessage = {
            type: 'market',
            assets_ids: allAssets,
          };
          try {
            this.wsClient.send(JSON.stringify(subscribeMessage));
            this.logger.info({ assetCount: allAssets.length }, '✅ [PolymarketWebSocketCollectorService] [connect] Re-subscribed to existing assets');
          } catch (error) {
            this.logger.error({ error: error instanceof Error ? error.message : String(error) }, '🔴 [PolymarketWebSocketCollectorService] [connect] Re-subscription failed');
          }
        }
      });

      this.wsClient.on('message', (data: WebSocket.Data) => {
        this.handleMessage(data);
      });

      this.wsClient.on('error', (error: Error) => {
        this.logger.error({ error: error.message }, '🔴 [PolymarketWebSocketCollectorService] [connect] WebSocket error');
        this.isConnected = false;
      });

      this.wsClient.on('close', (code: number, reason: Buffer) => {
        this.isConnected = false;
        this.logger.warn({ code, reason: reason.toString() }, '⚠️ [PolymarketWebSocketCollectorService] [connect] WebSocket closed');

        // Stop ping loop
        if (this.pingInterval) {
          clearInterval(this.pingInterval);
          this.pingInterval = null;
        }

        // Attempt reconnection
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff
          this.logger.info(
            { attempt: this.reconnectAttempts, delay },
            '🔄 [PolymarketWebSocketCollectorService] [connect] Attempting reconnection',
          );
          setTimeout(() => {
            this.connect();
          }, delay);
        } else {
          this.logger.error('🔴 [PolymarketWebSocketCollectorService] [connect] Max reconnection attempts reached');
        }
      });
    } catch (error) {
      this.logger.error({ error: error.message }, '🔴 [PolymarketWebSocketCollectorService] [connect] Connection failed');
      throw error;
    }
  }

  /**
   * Start ping loop to keep connection alive
   */
  private startPingLoop(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    this.pingInterval = setInterval(() => {
      if (this.isConnected && this.wsClient?.readyState === WebSocket.OPEN) {
        try {
          this.wsClient.ping();
          this.logger.debug('🔄 [PolymarketWebSocketCollectorService] [startPingLoop] PING sent');
        } catch (error) {
          this.logger.error({ error: error.message }, '🔴 [PolymarketWebSocketCollectorService] [startPingLoop] PING failed');
        }
      }
    }, PING_INTERVAL);
  }

  /**
   * Subscribe to assets
   * @param assetIds Array of asset IDs to subscribe
   * @param marketSlug Market slug associated with these assets
   * @param marketStatus Current status of the market
   * @param assetYesId YES asset ID
   * @param assetNoId NO asset ID
   */
  subscribe(assetIds: string[], marketSlug?: string, marketStatus?: MarketStatus, assetYesId?: string, assetNoId?: string): void {
    if (!this.isConnected || this.wsClient?.readyState !== WebSocket.OPEN) {
      this.logger.warn('⚠️ [PolymarketWebSocketCollectorService] [subscribe] WebSocket not connected');
      return;
    }

    // Filter only new assets (not already subscribed)
    const newAssets = assetIds.filter((assetId) => !this.subscribedAssets.has(assetId));
    if (newAssets.length === 0) {
      this.logger.debug({ assetIds }, 'ℹ️ [PolymarketWebSocketCollectorService] [subscribe] Already subscribed to all assets');
      return;
    }

    // Add to subscribed assets set and update asset to market map
    newAssets.forEach((assetId) => {
      this.subscribedAssets.add(assetId);
      // Update asset to market map if provided
      if (marketSlug && marketStatus) {
        this.assetToMarketMap.set(assetId, {
          slug: marketSlug,
          status: marketStatus,
          assetYesId: assetYesId || '',
          assetNoId: assetNoId || '',
        });
      }
    });

    // Get all subscribed assets for subscription message
    const allAssets = Array.from(this.subscribedAssets);

    // Send subscription message (only new assets)
    const subscribeMessage = {
      type: 'market',
      assets_ids: newAssets,
    };

    try {
      this.wsClient.send(JSON.stringify(subscribeMessage));
      this.logger.info(
        { assetCount: allAssets.length, newAssets, marketSlug },
        '✅ [PolymarketWebSocketCollectorService] [subscribe] Subscribed to assets',
      );
    } catch (error) {
      this.logger.error({ error: error instanceof Error ? error.message : String(error) }, '🔴 [PolymarketWebSocketCollectorService] [subscribe] Subscription failed');
    }
  }

  /**
   * Unsubscribe from assets
   */
  unsubscribe(assetIds: string[]): void {
    if (!this.isConnected || this.wsClient?.readyState !== WebSocket.OPEN) {
      this.logger.warn('⚠️ [PolymarketWebSocketCollectorService] [unsubscribe] WebSocket not connected');
      return;
    }

    // Remove from subscribed assets set
    assetIds.forEach((assetId) => {
      this.subscribedAssets.delete(assetId);
      this.assetToMarketMap.delete(assetId);
    });

    // Get remaining subscribed assets
    const remainingAssets = Array.from(this.subscribedAssets);

    // Re-subscribe with remaining assets
    if (remainingAssets.length > 0) {
      const subscribeMessage = {
        type: 'market',
        assets_ids: remainingAssets,
      };

      try {
        this.wsClient.send(JSON.stringify(subscribeMessage));
        this.logger.info(
          { remainingCount: remainingAssets.length, unsubscribedAssets: assetIds },
          '✅ [PolymarketWebSocketCollectorService] [unsubscribe] Unsubscribed from assets',
        );
      } catch (error) {
        this.logger.error({ error: error.message }, '🔴 [PolymarketWebSocketCollectorService] [unsubscribe] Unsubscription failed');
      }
    } else {
      // No assets remaining, send empty subscription
      const subscribeMessage = {
        type: 'market',
        assets_ids: [],
      };

      try {
        this.wsClient.send(JSON.stringify(subscribeMessage));
        this.logger.info('✅ [PolymarketWebSocketCollectorService] [unsubscribe] Unsubscribed from all assets');
      } catch (error) {
        this.logger.error({ error: error.message }, '🔴 [PolymarketWebSocketCollectorService] [unsubscribe] Unsubscription failed');
      }
    }
  }

  /**
   * Handle incoming WebSocket message
   */
  private handleMessage(data: WebSocket.Data): void {
    try {
      const messageStr = data.toString().trim();

      // Handle non-JSON responses (control messages)
      if (messageStr === 'PONG') {
        this.logger.debug('🔄 [PolymarketWebSocketCollectorService] [handleMessage] PONG received');
        return;
      }

      if (messageStr === 'INVALID OPERATION' || messageStr.startsWith('INVALID')) {
        this.logger.warn({ message: messageStr }, '⚠️ [PolymarketWebSocketCollectorService] [handleMessage] Invalid operation received');
        // Save as unknown message for tracking
        this.batchService.saveRawMessage(
          null,
          null,
          WebSocketEventType.UNKNOWN,
          MarketStatus.UNKNOWN,
          { raw_message: messageStr, type: 'control_message' },
        );
        return;
      }

      // Try to parse as JSON
      let message: any;
      try {
        message = JSON.parse(messageStr);
      } catch (parseError) {
        // Not a JSON message, handle as text/control message
        this.logger.debug({ message: messageStr }, '🔄 [PolymarketWebSocketCollectorService] [handleMessage] Non-JSON message received');
        this.batchService.saveRawMessage(
          null,
          null,
          WebSocketEventType.UNKNOWN,
          MarketStatus.UNKNOWN,
          { raw_message: messageStr, type: 'text_message' },
        );
        return;
      }

      // Handle empty array (subscribe response)
      if (Array.isArray(message) && message.length === 0) {
        this.logger.debug('🔄 [PolymarketWebSocketCollectorService] [handleMessage] Empty subscription response');
        return;
      }

      // Handle array of events (theo Python code: message có thể là array chứa nhiều events)
      if (Array.isArray(message) && message.length > 0) {
        // Check if this is a subscription response (array of asset IDs as strings)
        const isSubscriptionResponse = message.every((item) => typeof item === 'string');
        
        if (isSubscriptionResponse) {
          this.logger.debug(
            { subscribedAssets: message.length },
            '✅ [PolymarketWebSocketCollectorService] [handleMessage] Subscription confirmed',
          );
          // Save subscription response for tracking
          this.batchService.saveRawMessage(
            null,
            null,
            WebSocketEventType.UNKNOWN,
            MarketStatus.UNKNOWN,
            { type: 'subscription_response', subscribed_assets: message },
          );
          return;
        } else {
          // Array of event objects - process each event individually
          this.logger.debug(
            { eventCount: message.length },
            '🔄 [PolymarketWebSocketCollectorService] [handleMessage] Processing array of events',
          );
          for (const event of message) {
            this.processEvent(event);
          }
          return;
        }
      }

      // Process single event
      this.processEvent(message);
    } catch (error) {
      this.logger.error(
        { error: error instanceof Error ? error.message : String(error), data: data.toString().substring(0, 200) },
        '🔴 [PolymarketWebSocketCollectorService] [handleMessage] Error processing message',
      );
      // Save error message for tracking
      try {
        this.batchService.saveRawMessage(
          null,
          null,
          WebSocketEventType.UNKNOWN,
          MarketStatus.UNKNOWN,
          { raw_message: data.toString().substring(0, 500), type: 'error', error: error instanceof Error ? error.message : String(error) },
        );
      } catch (e) {
        // Ignore if can't save
      }
    }
  }

  /**
   * Process a single event (can be called from handleMessage or from array processing)
   */
  private processEvent(message: any): void {
    // Determine event type and process
    // Strategy: Lưu tất cả messages với classification rõ ràng để dễ query và phân tích
    const explicitEventType = message.event_type || message.type || null;
      
      // Try to extract asset_id from multiple possible locations
      let assetId: string | null = null;
      if (message.asset_id) {
        assetId = message.asset_id;
      } else if (message.payload?.asset_id) {
        assetId = message.payload.asset_id;
      } else if (message.data?.asset_id) {
        assetId = message.data.asset_id;
      } else if (message.payload?.data?.[0]?.asset_id) {
        assetId = message.payload.data[0].asset_id;
      } else if (Array.isArray(message.payload) && message.payload[0]?.asset_id) {
        assetId = message.payload[0].asset_id;
      }
      
      // Get market info if asset_id found
      const marketInfo = assetId ? this.assetToMarketMap.get(assetId) : null;
      const marketSlug = marketInfo?.slug || null;
      const marketStatus = marketInfo?.status || null;
      
      // Classify event type based on message structure
      let detectedEventType: WebSocketEventType = WebSocketEventType.UNKNOWN;
      
      // Priority 1: Check explicit event_type first (theo Python code: event_type == "book" hoặc "price_change")
      if (explicitEventType === 'book') {
        // BOOK event - orderbook update with bids/asks
        detectedEventType = WebSocketEventType.BOOK;
        this.processBookEvent(message, assetId, marketInfo);
        return; // Already processed
      }
      
      if (explicitEventType === 'price_change') {
        // PRICE_CHANGE event (có thể có price_changes array hoặc price field)
        if (message.price_changes && Array.isArray(message.price_changes) && message.price_changes.length > 0) {
          detectedEventType = WebSocketEventType.PRICE_CHANGE;
          this.processPriceChangeEvent(message).catch((error) => {
            this.logger.error(
              { error: error instanceof Error ? error.message : String(error), assetId, marketSlug },
              '🔴 [PolymarketWebSocketCollectorService] [processEvent] Error processing price change event',
            );
          });
          return; // Already processed (async)
        }
        // Single price_change event with price field
        if (assetId) {
          detectedEventType = WebSocketEventType.PRICE_CHANGE;
          this.processSinglePriceChangeEvent(message, assetId, marketInfo).catch((error) => {
            this.logger.error(
              { error: error instanceof Error ? error.message : String(error), assetId, marketSlug },
              '🔴 [PolymarketWebSocketCollectorService] [processEvent] Error processing single price change event',
            );
          });
          return; // Already processed (async)
        }
      }

      // Priority 2: Check for price_change event by structure (has price_changes array)
      if (message.price_changes && Array.isArray(message.price_changes) && message.price_changes.length > 0) {
        detectedEventType = WebSocketEventType.PRICE_CHANGE;
        this.processPriceChangeEvent(message).catch((error) => {
          this.logger.error(
            { error: error instanceof Error ? error.message : String(error), assetId, marketSlug },
            '🔴 [PolymarketWebSocketCollectorService] [processEvent] Error processing price change event',
          );
        });
        return; // Already processed (async)
      }
      
      // Priority 3: Check for book event by structure (has bids/asks arrays)
      if (message.bids && Array.isArray(message.bids) && message.asks && Array.isArray(message.asks)) {
        detectedEventType = WebSocketEventType.BOOK;
        this.processBookEvent(message, assetId, marketInfo);
        return; // Already processed
      }
      
      // Priority 4: Messages with asset_id - process as last_trade_price (most common case)
      if (assetId) {
        detectedEventType = WebSocketEventType.LAST_TRADE_PRICE;
        
        // Process last trade price event (async, fire-and-forget)
        // This will save trade to market_trades table and also save raw message
        this.processLastTradePriceEvent(message).catch((error) => {
          this.logger.error(
            { error: error instanceof Error ? error.message : String(error), assetId, marketSlug },
            '🔴 [PolymarketWebSocketCollectorService] [processEvent] Error processing last trade price event',
          );
        });
        
        return; // Already processed (async)
      }
      
      // Priority 5: Messages without asset_id - save with detailed classification for analysis
      else {
        // No asset_id found - save with classification metadata for analysis
        detectedEventType = WebSocketEventType.UNKNOWN;
        
        const enrichedMessage = {
          ...message,
          _classification: {
            detected_event_type: detectedEventType,
            explicit_event_type: explicitEventType,
            has_asset_id: false,
            has_price: 'price' in message,
            has_price_changes: !!message.price_changes,
            has_bids: !!message.bids,
            has_asks: !!message.asks,
            is_array: Array.isArray(message),
            message_structure: {
              root_keys: Object.keys(message),
              has_payload: !!message.payload,
              has_data: !!message.data,
              payload_keys: message.payload ? Object.keys(message.payload) : null,
              data_keys: message.data ? Object.keys(message.data) : null,
            },
          },
        };
        
        this.batchService.saveRawMessage(
          null,
          null,
          detectedEventType,
          MarketStatus.UNKNOWN,
          enrichedMessage,
        );
        
        this.logger.debug(
          {
            explicitEventType,
            messageKeys: Object.keys(message),
            isArray: Array.isArray(message),
          },
          '⚠️ [PolymarketWebSocketCollectorService] [processEvent] Processed message without asset_id - saved with classification metadata',
        );
      }
  }

  /**
   * Process last trade price event
   * Parse and save trade to market_trades table with type YES/NO
   */
  private async processLastTradePriceEvent(message: any): Promise<void> {
    const assetId = message.asset_id || message.payload?.asset_id || message.data?.asset_id;
    const marketInfo = assetId ? this.assetToMarketMap.get(assetId) : null;

    const marketSlug = marketInfo?.slug || null;
    const marketStatus = marketInfo?.status || null;

    // Parse trade data from message (theo Python collector logic)
    const marketId = message.market || message.condition_id || null; // condition ID from event
    const price = parseFloat(message.price || 0);
    const size = parseFloat(message.size || 0);
    const side = message.side || ''; // "BUY" or "SELL"
    const feeRateBps = parseInt(message.fee_rate_bps || '0', 10) || null;
    const timestampMs = message.timestamp || Date.now();
    const timestamp = new Date(typeof timestampMs === 'number' ? (timestampMs > 1e12 ? timestampMs : timestampMs * 1000) : Date.now());

    // Determine type (YES/NO) based on asset_id and market registry
    // Also get open_price from market registry for delta_price calculation
    let tradeType: 'YES' | 'NO' | null = null;
    let openPrice: number | null = null;
    if (assetId && marketSlug) {
      try {
        const market = await this.marketRegistry.findBySlug(marketSlug);
        if (market) {
          // Compare asset_id with asset_yes_id and asset_no_id
          if (assetId === market.asset_yes_id) {
            tradeType = 'YES';
          } else if (assetId === market.asset_no_id) {
            tradeType = 'NO';
          } else {
            this.logger.warn(
              { assetId, marketSlug, assetYesId: market.asset_yes_id, assetNoId: market.asset_no_id },
              '⚠️ [PolymarketWebSocketCollectorService] [processLastTradePriceEvent] Asset ID does not match YES or NO asset',
            );
          }
          // Get open_price from market registry
          openPrice = market.open_price;
        }
      } catch (error) {
        this.logger.error(
          { error: error instanceof Error ? error.message : String(error), marketSlug },
          '🔴 [PolymarketWebSocketCollectorService] [processLastTradePriceEvent] Error finding market registry',
        );
      }
    }

    // Get current Chainlink price from cache
    const currentChainlinkPrice = this.priceWebSocketService.getCurrentChainlinkPrice();

    // Calculate delta_price = price_chainlink - open_price (if both are available)
    let deltaPrice: number | null = null;
    if (currentChainlinkPrice !== null && openPrice !== null) {
      deltaPrice = currentChainlinkPrice - openPrice;
    }

    // Save trade to market_trades table if we have valid data
    if (assetId && side && tradeType && price > 0 && size > 0) {
      try {
        await this.tradeBatchService.saveTrade({
          market_slug: marketSlug,
          market_id: marketId,
          asset_id: assetId,
          price,
          size,
          side,
          fee_rate_bps: feeRateBps,
          type: tradeType,
          timestamp,
          price_chainlink: currentChainlinkPrice,
          delta_price: deltaPrice,
        });

        this.logger.debug(
          { assetId, marketSlug, tradeType, price, size, side, price_chainlink: currentChainlinkPrice, delta_price: deltaPrice, open_price: openPrice },
          '✅ [PolymarketWebSocketCollectorService] [processLastTradePriceEvent] Saved trade to market_trades',
        );
      } catch (error) {
        this.logger.error(
          { error: error instanceof Error ? error.message : String(error), assetId, marketSlug },
          '🔴 [PolymarketWebSocketCollectorService] [processLastTradePriceEvent] Error saving trade',
        );
      }
    } else {
      this.logger.debug(
        { assetId, side, tradeType, price, size },
        '⚠️ [PolymarketWebSocketCollectorService] [processLastTradePriceEvent] Skipping trade - missing required fields',
      );
    }

    // Also save raw message to ws_raw_messages table (existing behavior)
    const enrichedMessage = {
      ...message,
      _classification: {
        event_type: WebSocketEventType.LAST_TRADE_PRICE,
        explicit_event_type: message.event_type || message.type || null,
        has_price: 'price' in message,
        price_value: message.price || null,
        has_timestamp: 'timestamp' in message,
        asset_id_source: message.asset_id ? 'root' : message.payload?.asset_id ? 'payload' : message.data?.asset_id ? 'data' : 'unknown',
        trade_type: tradeType, // Add trade_type to classification for easier querying
      },
    };

    this.batchService.saveRawMessage(
      marketSlug,
      assetId,
      WebSocketEventType.LAST_TRADE_PRICE,
      marketStatus,
      enrichedMessage,
    );

    this.logger.debug(
      { assetId, marketSlug, marketStatus, hasPrice: 'price' in message, tradeType },
      '🔄 [PolymarketWebSocketCollectorService] [processLastTradePriceEvent] Processed last trade price event',
    );
  }

  /**
   * Process book event (orderbook update with bids/asks)
   */
  private processBookEvent(message: any, assetId: string | null, marketInfo: any): void {
    const bids = message.bids || [];
    const asks = message.asks || [];
    
    // Try to extract asset_id from message if not provided
    const finalAssetId = assetId || message.asset_id || null;
    const finalMarketInfo = finalAssetId ? this.assetToMarketMap.get(finalAssetId) : (marketInfo || null);
    
    const marketSlug = finalMarketInfo?.slug || null;
    const marketStatus = finalMarketInfo?.status || null;
    
    // Calculate best bid/ask (theo Python code)
    let bestBid = 0;
    let bestAsk = 0;
    if (bids.length > 0) {
      bestBid = Math.max(...bids.map((b: any) => parseFloat(b.price || b[0] || 0)));
    }
    if (asks.length > 0) {
      bestAsk = Math.min(...asks.map((a: any) => parseFloat(a.price || a[0] || 0)));
    }
    
    // Enrich message with classification metadata
    const enrichedMessage = {
      ...message,
      _classification: {
        event_type: WebSocketEventType.BOOK,
        explicit_event_type: message.event_type || message.type || null,
        bids_count: bids.length,
        asks_count: asks.length,
        best_bid: bestBid,
        best_ask: bestAsk,
        has_timestamp: 'timestamp' in message,
        asset_id_source: finalAssetId ? (message.asset_id ? 'root' : 'parameter') : 'missing',
      },
      _orderbook_summary: {
        best_bid: bestBid,
        best_ask: bestAsk,
        spread: bestAsk > 0 && bestBid > 0 ? bestAsk - bestBid : null,
        bids_levels: bids.length,
        asks_levels: asks.length,
      },
    };
    
    this.batchService.saveRawMessage(
      marketSlug,
      finalAssetId,
      WebSocketEventType.BOOK,
      marketStatus,
      enrichedMessage,
    );
    
    this.logger.debug(
      { 
        assetId: finalAssetId, 
        marketSlug, 
        bestBid, 
        bestAsk, 
        bidsCount: bids.length, 
        asksCount: asks.length,
      },
      '📚 [PolymarketWebSocketCollectorService] [processBookEvent] Processed book event',
    );
  }

  /**
   * Process single price change event (not array of price_changes)
   * Save to market_price_changes table (similar to Python collector)
   */
  private async processSinglePriceChangeEvent(message: any, assetId: string, marketInfo: any): Promise<void> {
    if (!assetId || !marketInfo) {
      return;
    }

    const marketSlug = marketInfo.slug;
    const marketStatus = marketInfo.status;
    
    // Parse price change data
    const messageTimestamp = message.timestamp || Date.now();
    const timestamp = new Date(typeof messageTimestamp === 'number' ? (messageTimestamp > 1e12 ? messageTimestamp : messageTimestamp * 1000) : Date.now());
    const price = parseFloat(message.price || 0);
    const size = parseFloat(message.size || 0);
    const side = message.side || ''; // "BUY" or "SELL"
    const orderHash = message.hash || message.order_hash || null;
    const bestBid = message.best_bid !== undefined ? parseFloat(message.best_bid) : null;
    const bestAsk = message.best_ask !== undefined ? parseFloat(message.best_ask) : null;

    if (!side) {
      // No side, skip but save to raw messages
      const enrichedMessage = {
        ...message,
        _classification: {
          event_type: WebSocketEventType.PRICE_CHANGE,
          explicit_event_type: message.event_type || message.type || null,
          price: message.price || null,
          has_timestamp: 'timestamp' in message,
          asset_id_source: message.asset_id ? 'root' : 'parameter',
        },
      };
      this.batchService.saveRawMessage(marketSlug, assetId, WebSocketEventType.PRICE_CHANGE, marketStatus, enrichedMessage);
      return;
    }

    // Save to market_price_changes table
    try {
      await this.priceChangeBatchService.savePriceChange({
        market_slug: marketSlug,
        market_id: marketSlug, // Use market_slug as market_id
        asset_id: assetId,
        price: price,
        size: size,
        side: side,
        order_hash: orderHash,
        best_bid: bestBid,
        best_ask: bestAsk,
        timestamp: timestamp,
      });

      this.logger.debug(
        { assetId, marketSlug, price, size, side, bestBid, bestAsk },
        '✅ [PolymarketWebSocketCollectorService] [processSinglePriceChangeEvent] Saved single price change to market_price_changes',
      );
    } catch (error) {
      this.logger.error(
        { assetId, marketSlug, error: error instanceof Error ? error.message : String(error) },
        '🔴 [PolymarketWebSocketCollectorService] [processSinglePriceChangeEvent] Error saving price change',
      );
    }

    // Also save raw message for debugging/analysis
    const enrichedMessage = {
      ...message,
      _classification: {
        event_type: WebSocketEventType.PRICE_CHANGE,
        explicit_event_type: message.event_type || message.type || null,
        price: message.price || null,
        has_timestamp: 'timestamp' in message,
        asset_id_source: message.asset_id ? 'root' : 'parameter',
      },
    };
    this.batchService.saveRawMessage(marketSlug, assetId, WebSocketEventType.PRICE_CHANGE, marketStatus, enrichedMessage);
  }

  /**
   * Process price change event (array of price_changes)
   * Save to market_price_changes table (similar to Python collector)
   */
  private async processPriceChangeEvent(message: any): Promise<void> {
    const priceChanges = message.price_changes || [];
    const messageTimestamp = message.timestamp || Date.now();
    const timestamp = new Date(typeof messageTimestamp === 'number' ? (messageTimestamp > 1e12 ? messageTimestamp : messageTimestamp * 1000) : Date.now());

    // Enrich message with classification metadata for raw messages
    const baseEnrichedMessage = {
      ...message,
      _classification: {
        event_type: WebSocketEventType.PRICE_CHANGE,
        explicit_event_type: message.event_type || message.type || null,
        price_changes_count: priceChanges.length,
        has_timestamp: 'timestamp' in message,
      },
    };

    for (const change of priceChanges) {
      if (!change || typeof change !== 'object') {
        continue;
      }

      const assetId = change.asset_id;
      if (!assetId) {
        continue;
      }

      const marketInfo = this.assetToMarketMap.get(assetId);
      if (!marketInfo) {
        // No market info found, still save to raw messages
        const enrichedMessage = {
          ...baseEnrichedMessage,
          _current_asset: {
            asset_id: assetId,
            price: change.price || null,
            best_ask: change.best_ask || null,
            best_bid: change.best_bid || null,
          },
        };
        this.batchService.saveRawMessage(null, assetId, WebSocketEventType.PRICE_CHANGE, MarketStatus.UNKNOWN, enrichedMessage);
        continue;
      }

      const marketSlug = marketInfo.slug;
      const marketStatus = marketInfo.status;

      // Parse price change data (theo Python collector logic)
      const price = parseFloat(change.price || 0);
      const size = parseFloat(change.size || 0);
      const side = change.side || ''; // "BUY" or "SELL"
      const orderHash = change.hash || change.order_hash || null;
      const bestBid = change.best_bid !== undefined ? parseFloat(change.best_bid) : null;
      const bestAsk = change.best_ask !== undefined ? parseFloat(change.best_ask) : null;

      if (!side) {
        // No side, skip but save to raw messages
        const enrichedMessage = {
          ...baseEnrichedMessage,
          _current_asset: {
            asset_id: assetId,
            price: change.price || null,
            best_ask: change.best_ask || null,
            best_bid: change.best_bid || null,
          },
        };
        this.batchService.saveRawMessage(marketSlug, assetId, WebSocketEventType.PRICE_CHANGE, marketStatus, enrichedMessage);
        continue;
      }

      // Save to market_price_changes table
      try {
        await this.priceChangeBatchService.savePriceChange({
          market_slug: marketSlug,
          market_id: marketSlug, // Use market_slug as market_id (similar to Python)
          asset_id: assetId,
          price: price,
          size: size,
          side: side,
          order_hash: orderHash,
          best_bid: bestBid,
          best_ask: bestAsk,
          timestamp: timestamp,
        });

        this.logger.debug(
          { assetId, marketSlug, price, size, side, bestBid, bestAsk },
          '✅ [PolymarketWebSocketCollectorService] [processPriceChangeEvent] Saved price change to market_price_changes',
        );
      } catch (error) {
        this.logger.error(
          { assetId, marketSlug, error: error instanceof Error ? error.message : String(error) },
          '🔴 [PolymarketWebSocketCollectorService] [processPriceChangeEvent] Error saving price change',
        );
      }

      // Also save raw message for debugging/analysis
      const enrichedMessage = {
        ...baseEnrichedMessage,
        _current_asset: {
          asset_id: assetId,
          price: change.price || null,
          best_ask: change.best_ask || null,
          best_bid: change.best_bid || null,
          asks_size: change.asks_size || null,
          bids_size: change.bids_size || null,
        },
      };
      this.batchService.saveRawMessage(marketSlug, assetId, WebSocketEventType.PRICE_CHANGE, marketStatus, enrichedMessage);
    }
  }


  /**
   * Disconnect WebSocket
   */
  async disconnect(): Promise<void> {
    this.logger.info('🔄 [PolymarketWebSocketCollectorService] [disconnect] Disconnecting WebSocket');

    // Stop ping loop
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    // Close WebSocket connection
    if (this.wsClient) {
      this.wsClient.removeAllListeners();
      if (this.wsClient.readyState === WebSocket.OPEN) {
        this.wsClient.close();
      }
      this.wsClient = null;
    }

    this.isConnected = false;
    this.subscribedAssets.clear();
    this.assetToMarketMap.clear();

    this.logger.info('✅ [PolymarketWebSocketCollectorService] [disconnect] WebSocket disconnected');
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): boolean {
    return this.isConnected && this.wsClient?.readyState === WebSocket.OPEN;
  }

  /**
   * Get subscribed assets count
   */
  getSubscribedAssetsCount(): number {
    return this.subscribedAssets.size;
  }

  /**
   * Cleanup on module destroy
   */
  async onModuleDestroy(): Promise<void> {
    this.logger.info('🔄 [PolymarketWebSocketCollectorService] [onModuleDestroy] Cleaning up');
    await this.disconnect();
  }
}

