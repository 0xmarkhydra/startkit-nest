import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import axios, { AxiosError } from 'axios';
import { POLYMARKET_GAMMA_API_URL } from '@/shared/constants/polymarket.constants';

export interface MarketInfo {
  conditionId: string;
  assetYesId: string;
  assetNoId: string;
  startTimestamp: number;
  endTimestamp: number;
}

export interface GammaMarket {
  id: string;
  conditionId: string;
  question: string;
  clobTokenIds: string[];
  enableOrderBook: boolean;
  active: boolean;
  outcomes?: Array<{ outcome: string; tokenId: string }>;
  startTimestamp?: number;
  endTimestamp?: number;
}

export interface GammaEvent {
  id: string;
  slug: string;
  markets: GammaMarket[];
  startDate?: string;
  endDate?: string;
}

@Injectable()
export class PolymarketGammaService {
  private readonly apiUrl: string;

  constructor(@InjectPinoLogger(PolymarketGammaService.name) private readonly logger: PinoLogger) {
    this.apiUrl = POLYMARKET_GAMMA_API_URL;
  }

  /**
   * Fetch market information by slug
   * @param slug Market slug (e.g., "btc-updown-15m-1735689600")
   * @returns Market info with conditionId, assetYesId, assetNoId, timestamps
   */
  async fetchMarketBySlug(slug: string): Promise<MarketInfo | null> {
    try {
      this.logger.info({ slug }, '🔍 [PolymarketGammaService] [fetchMarketBySlug] Fetching market');

      // Call Gamma API: GET /events?slug={slug}
      const response = await axios.get<GammaEvent[]>(`${this.apiUrl}/events`, {
        params: { slug },
        timeout: 10000,
      });

      if (!response.data || response.data.length === 0) {
        this.logger.warn({ slug }, '⚠️ [PolymarketGammaService] [fetchMarketBySlug] Market not found');
        return null;
      }

      // Extract first event (should be unique by slug)
      const event = response.data[0];
      if (!event.markets || !Array.isArray(event.markets) || event.markets.length === 0) {
        this.logger.warn({ slug, event }, '⚠️ [PolymarketGammaService] [fetchMarketBySlug] No markets found in event');
        return null;
      }

      // Find market with enableOrderBook = true
      const market = event.markets.find((m: any) => m.enableOrderBook === true);
      if (!market) {
        this.logger.warn({ slug, markets: event.markets }, '⚠️ [PolymarketGammaService] [fetchMarketBySlug] No market with enableOrderBook found');
        return null;
      }

      // Log market structure for debugging
      this.logger.debug(
        {
          slug,
          market: {
            id: market.id,
            clobTokenIds: market.clobTokenIds,
            clobTokenIdsType: typeof market.clobTokenIds,
            clobTokenIdsIsArray: Array.isArray(market.clobTokenIds),
            outcomes: market.outcomes,
          },
        },
        '🔄 [PolymarketGammaService] [fetchMarketBySlug] Found market',
      );

      // Extract clobTokenIds (usually [NO, YES] or [assetNoId, assetYesId])
      // Handle case where clobTokenIds might be a string or array
      let clobTokenIds: string[] = [];
      const rawClobTokenIds = (market as any).clobTokenIds;
      
      if (Array.isArray(rawClobTokenIds)) {
        clobTokenIds = rawClobTokenIds;
      } else if (typeof rawClobTokenIds === 'string') {
        try {
          const parsed = JSON.parse(rawClobTokenIds);
          if (Array.isArray(parsed)) {
            clobTokenIds = parsed;
          } else {
            // If not array after parsing, try to split by comma
            clobTokenIds = rawClobTokenIds.split(',').map((s: string) => s.trim());
          }
        } catch (e) {
          // If not JSON, try to split by comma
          clobTokenIds = rawClobTokenIds.split(',').map((s: string) => s.trim());
        }
      }
      
      if (!Array.isArray(clobTokenIds) || clobTokenIds.length < 2) {
        this.logger.warn(
          { slug, clobTokenIds, clobTokenIdsType: typeof market.clobTokenIds, market },
          '⚠️ [PolymarketGammaService] [fetchMarketBySlug] Invalid clobTokenIds',
        );
        return null;
      }
      
      // Ensure all token IDs are valid strings
      clobTokenIds = clobTokenIds
        .map((id: any) => {
          // Convert to string and trim
          const strId = String(id || '').trim();
          return strId;
        })
        .filter((id: string) => id && id.length > 0 && id !== 'null' && id !== 'undefined');
      
      if (clobTokenIds.length < 2) {
        this.logger.warn(
          { slug, clobTokenIds, originalClobTokenIds: market.clobTokenIds, market },
          '⚠️ [PolymarketGammaService] [fetchMarketBySlug] Invalid clobTokenIds after filtering',
        );
        return null;
      }
      
      this.logger.debug(
        { slug, clobTokenIds, originalClobTokenIds: market.clobTokenIds },
        '🔄 [PolymarketGammaService] [fetchMarketBySlug] Parsed clobTokenIds',
      );

      // Determine YES and NO token IDs
      // Based on outcomes or order: usually [NO, YES] or [assetNoId, assetYesId]
      let assetYesId: string;
      let assetNoId: string;

      // Try to parse outcomes if available
      try {
        const outcomes = market.outcomes;
        if (outcomes && Array.isArray(outcomes) && outcomes.length >= 2) {
          // Use outcomes to determine order
          const yesOutcome = outcomes.find((o: any) => {
            try {
              const outcome = typeof o === 'object' && o !== null 
                ? (o.outcome || o.title || o.name || '').toLowerCase() 
                : String(o || '').toLowerCase();
              return outcome === 'yes';
            } catch (e) {
              return false;
            }
          });
          const noOutcome = outcomes.find((o: any) => {
            try {
              const outcome = typeof o === 'object' && o !== null 
                ? (o.outcome || o.title || o.name || '').toLowerCase() 
                : String(o || '').toLowerCase();
              return outcome === 'no';
            } catch (e) {
              return false;
            }
          });
          
          if (yesOutcome && noOutcome && typeof yesOutcome === 'object' && typeof noOutcome === 'object') {
            // Extract tokenId, handling different possible property names
            const yesTokenId = (yesOutcome as any).tokenId || (yesOutcome as any).id || (yesOutcome as any).token_id;
            const noTokenId = (noOutcome as any).tokenId || (noOutcome as any).id || (noOutcome as any).token_id;
            
            assetYesId = yesTokenId || clobTokenIds[1];
            assetNoId = noTokenId || clobTokenIds[0];
            
            if (yesTokenId && noTokenId && yesTokenId !== clobTokenIds[1] && noTokenId !== clobTokenIds[0]) {
              // Found valid outcomes, use them
              this.logger.debug({ slug, assetYesId, assetNoId }, '🔄 [PolymarketGammaService] [fetchMarketBySlug] Using outcomes to determine token IDs');
            } else {
              // Fallback to clobTokenIds order
              assetNoId = clobTokenIds[0];
              assetYesId = clobTokenIds[1];
            }
          } else {
            // Fallback: assume order is [NO, YES]
            assetNoId = clobTokenIds[0];
            assetYesId = clobTokenIds[1];
          }
        } else {
          // Fallback: assume order is [NO, YES] based on typical Polymarket structure
          assetNoId = clobTokenIds[0];
          assetYesId = clobTokenIds[1];
        }
      } catch (outcomesError) {
        // If parsing outcomes fails, use clobTokenIds order
        this.logger.warn(
          { slug, error: outcomesError instanceof Error ? outcomesError.message : String(outcomesError) },
          '⚠️ [PolymarketGammaService] [fetchMarketBySlug] Error parsing outcomes, using clobTokenIds order',
        );
        assetNoId = clobTokenIds[0];
        assetYesId = clobTokenIds[1];
      }

      // Extract timestamps
      // Try to get from market, event, or calculate from slug
      let startTimestamp: number;
      let endTimestamp: number;

      if (market.startTimestamp && market.endTimestamp) {
        startTimestamp = market.startTimestamp;
        endTimestamp = market.endTimestamp;
      } else if (event.startDate && event.endDate) {
        startTimestamp = Math.floor(new Date(event.startDate).getTime() / 1000);
        endTimestamp = Math.floor(new Date(event.endDate).getTime() / 1000);
      } else {
        // Extract timestamp from slug: "btc-updown-15m-{timestamp}"
        const timestampMatch = slug.match(/-(\d+)$/);
        if (timestampMatch) {
          startTimestamp = parseInt(timestampMatch[1], 10);
          endTimestamp = startTimestamp + 900; // 15 minutes = 900 seconds
        } else {
          this.logger.warn({ slug }, '⚠️ [PolymarketGammaService] [fetchMarketBySlug] Cannot extract timestamps');
          return null;
        }
      }

      const marketInfo: MarketInfo = {
        conditionId: market.conditionId,
        assetYesId,
        assetNoId,
        startTimestamp,
        endTimestamp,
      };

      this.logger.info({ slug, marketInfo }, '✅ [PolymarketGammaService] [fetchMarketBySlug] Market fetched successfully');

      return marketInfo;
    } catch (error) {
      const axiosError = error as AxiosError;
      
      // If it's not an axios error, log the error message
      if (!axiosError.response) {
        this.logger.error(
          {
            slug,
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          },
          '🔴 [PolymarketGammaService] [fetchMarketBySlug] Error fetching market (non-axios error)',
        );
      } else {
        this.logger.error(
          {
            slug,
            message: axiosError.message,
            status: axiosError.response?.status,
            statusText: axiosError.response?.statusText,
            data: JSON.stringify(axiosError.response?.data).substring(0, 500), // Limit log size
          },
          '🔴 [PolymarketGammaService] [fetchMarketBySlug] Error fetching market',
        );
      }
      
      // Don't throw, return null to allow retry
      return null;
    }
  }
}

