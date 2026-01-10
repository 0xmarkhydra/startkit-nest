import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import WebSocket from 'ws';
import { POLYMARKET_WS_URL, PING_INTERVAL, WebSocketEventType, MarketStatus } from '@/shared/constants/polymarket.constants';
import { RawMessageBatchService } from './raw-message-batch.service';

interface AssetMarketMap {
  slug: string;
  status: MarketStatus;
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
        if (this.subscribedAssets.size > 0) {
          this.logger.info(
            { assetCount: this.subscribedAssets.size },
            '🔄 [PolymarketWebSocketCollectorService] [connect] Re-subscribing to existing assets',
          );
          this.subscribe(Array.from(this.subscribedAssets));
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
   */
  subscribe(assetIds: string[], marketSlug?: string, marketStatus?: MarketStatus): void {
    if (!this.isConnected || this.wsClient?.readyState !== WebSocket.OPEN) {
      this.logger.warn('⚠️ [PolymarketWebSocketCollectorService] [subscribe] WebSocket not connected');
      return;
    }

    // Add to subscribed assets set
    assetIds.forEach((assetId) => {
      this.subscribedAssets.add(assetId);
      // Update asset to market map if provided
      if (marketSlug && marketStatus) {
        this.assetToMarketMap.set(assetId, { slug: marketSlug, status: marketStatus });
      }
    });

    // Get all subscribed assets for subscription message
    const allAssets = Array.from(this.subscribedAssets);

    // Send subscription message
    const subscribeMessage = {
      type: 'market',
      assets_ids: allAssets,
    };

    try {
      this.wsClient.send(JSON.stringify(subscribeMessage));
      this.logger.info(
        { assetCount: allAssets.length, newAssets: assetIds },
        '✅ [PolymarketWebSocketCollectorService] [subscribe] Subscribed to assets',
      );
    } catch (error) {
      this.logger.error({ error: error.message }, '🔴 [PolymarketWebSocketCollectorService] [subscribe] Subscription failed');
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
          this.processPriceChangeEvent(message);
          return; // Already processed
        }
        // Single price_change event with price field
        if (assetId) {
          detectedEventType = WebSocketEventType.PRICE_CHANGE;
          this.processSinglePriceChangeEvent(message, assetId, marketInfo);
          return; // Already processed
        }
      }
      
      // Priority 2: Check for price_change event by structure (has price_changes array)
      if (message.price_changes && Array.isArray(message.price_changes) && message.price_changes.length > 0) {
        detectedEventType = WebSocketEventType.PRICE_CHANGE;
        this.processPriceChangeEvent(message);
        return; // Already processed
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
        
        // Enrich message with classification metadata for easier querying
        const enrichedMessage = {
          ...message,
          _classification: {
            event_type: WebSocketEventType.LAST_TRADE_PRICE,
            explicit_event_type: explicitEventType,
            detected_reason: explicitEventType === 'last_trade_price' || explicitEventType === 'trade' 
              ? 'explicit_event_type' 
              : 'has_asset_id',
            has_price: 'price' in message,
            price_value: message.price !== undefined ? message.price : null,
            has_price_changes: !!message.price_changes,
            has_bids: !!message.bids,
            has_asks: !!message.asks,
            asset_id_location: message.asset_id ? 'root' : 'nested',
            has_timestamp: 'timestamp' in message,
          },
        };
        
        this.batchService.saveRawMessage(
          marketSlug,
          assetId,
          detectedEventType,
          marketStatus,
          enrichedMessage,
        );
        
        this.logger.debug(
          { 
            assetId, 
            marketSlug, 
            detectedEventType, 
            explicitEventType,
            hasPrice: 'price' in message,
            messageKeys: Object.keys(message).slice(0, 10), // Limit keys for logging
          },
          '✅ [PolymarketWebSocketCollectorService] [handleMessage] Processed message with asset_id as LAST_TRADE_PRICE',
        );
        return; // Already processed
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
   */
  private processLastTradePriceEvent(message: any): void {
    const assetId = message.asset_id || message.payload?.asset_id || message.data?.asset_id;
    const marketInfo = assetId ? this.assetToMarketMap.get(assetId) : null;

    const marketSlug = marketInfo?.slug || null;
    const marketStatus = marketInfo?.status || null;

    // Enrich message with classification metadata for easier querying
    const enrichedMessage = {
      ...message,
      _classification: {
        event_type: WebSocketEventType.LAST_TRADE_PRICE,
        explicit_event_type: message.event_type || message.type || null,
        has_price: 'price' in message,
        price_value: message.price || null,
        has_timestamp: 'timestamp' in message,
        asset_id_source: message.asset_id ? 'root' : message.payload?.asset_id ? 'payload' : message.data?.asset_id ? 'data' : 'unknown',
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
      { assetId, marketSlug, marketStatus, hasPrice: 'price' in message },
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
   */
  private processSinglePriceChangeEvent(message: any, assetId: string, marketInfo: any): void {
    const marketSlug = marketInfo?.slug || null;
    const marketStatus = marketInfo?.status || null;
    
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
    
    this.batchService.saveRawMessage(
      marketSlug,
      assetId,
      WebSocketEventType.PRICE_CHANGE,
      marketStatus,
      enrichedMessage,
    );
    
    this.logger.debug(
      { assetId, marketSlug, price: message.price },
      '💰 [PolymarketWebSocketCollectorService] [processSinglePriceChangeEvent] Processed single price change event',
    );
  }

  /**
   * Process price change event (array of price_changes)
   */
  private processPriceChangeEvent(message: any): void {
    const priceChanges = message.price_changes || [];

    // Enrich message with classification metadata
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
      if (change.asset_id) {
        const assetId = change.asset_id;
        const marketInfo = this.assetToMarketMap.get(assetId);

        const marketSlug = marketInfo?.slug || null;
        const marketStatus = marketInfo?.status || null;

        // Enrich with specific change info for this asset
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

        // Save each price change as separate message with full original message
        this.batchService.saveRawMessage(
          marketSlug,
          assetId,
          WebSocketEventType.PRICE_CHANGE,
          marketStatus,
          enrichedMessage,
        );

        this.logger.debug(
          { assetId, marketSlug, marketStatus, price: change.price },
          '🔄 [PolymarketWebSocketCollectorService] [processPriceChangeEvent] Processed price change event',
        );
      }
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

