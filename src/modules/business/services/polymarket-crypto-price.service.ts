import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import axios, { AxiosError } from 'axios';
import { POLYMARKET_CRYPTO_PRICE_API_URL } from '@/shared/constants/polymarket.constants';

export interface CryptoPriceResponse {
  openPrice: number;
  closePrice: number | null; // null if not completed
  timestamp: number;
  completed: boolean;
  incomplete: boolean;
  cached: boolean;
}

@Injectable()
export class PolymarketCryptoPriceService {
  private readonly apiUrl: string;

  constructor(@InjectPinoLogger(PolymarketCryptoPriceService.name) private readonly logger: PinoLogger) {
    this.apiUrl = POLYMARKET_CRYPTO_PRICE_API_URL;
  }

  /**
   * Extract symbol from market slug
   * Example: "btc-updown-15m-1735689600" -> "BTC"
   * @param slug Market slug
   * @returns Uppercase symbol (e.g., "BTC", "ETH")
   */
  extractSymbolFromSlug(slug: string): string {
    // Extract first part before "-updown-"
    // Format: "{symbol}-updown-15m-{timestamp}"
    const match = slug.match(/^([a-z]+)-updown-/i);
    if (match && match[1]) {
      return match[1].toUpperCase();
    }

    // Fallback: try to extract from beginning
    const parts = slug.split('-');
    if (parts.length > 0) {
      return parts[0].toUpperCase();
    }

    // Default to BTC if cannot extract
    this.logger.warn({ slug }, '⚠️ [PolymarketCryptoPriceService] [extractSymbolFromSlug] Cannot extract symbol, defaulting to BTC');
    return 'BTC';
  }

  /**
   * Convert Unix timestamp (seconds) to ISO 8601 format
   * Format: "YYYY-MM-DDTHH:mm:ssZ" (without milliseconds, như API example)
   * @param timestamp Unix timestamp in seconds
   * @returns ISO 8601 format string (e.g., "2026-01-07T22:45:00Z")
   */
  private timestampToISO(timestamp: number): string {
    const date = new Date(timestamp * 1000); // Convert seconds to milliseconds
    // Format: YYYY-MM-DDTHH:mm:ssZ (không có milliseconds)
    // Theo example từ user: "2026-01-07T22:45:00Z" (không có .000Z)
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    const seconds = String(date.getUTCSeconds()).padStart(2, '0');
    
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}Z`;
  }

  /**
   * Fetch crypto price data from Polymarket API
   * @param symbol Crypto symbol (e.g., "BTC", "ETH")
   * @param eventStartTime Start time in Unix timestamp (seconds)
   * @param endDate End time in Unix timestamp (seconds)
   * @returns CryptoPriceResponse or null if error
   */
  async fetchCryptoPrice(symbol: string, eventStartTime: number, endDate: number): Promise<CryptoPriceResponse | null> {
    try {
      const startTimeISO = this.timestampToISO(eventStartTime);
      const endDateISO = this.timestampToISO(endDate);

      const url = `${this.apiUrl}?symbol=${encodeURIComponent(symbol)}&eventStartTime=${encodeURIComponent(startTimeISO)}&variant=fifteen&endDate=${encodeURIComponent(endDateISO)}`;

      this.logger.info(
        {
          symbol,
          eventStartTime,
          endDate,
          startTimeISO,
          endDateISO,
          startTimeDate: new Date(eventStartTime * 1000).toISOString(),
          endDateDate: new Date(endDate * 1000).toISOString(),
          url,
        },
        '🔍 [PolymarketCryptoPriceService] [fetchCryptoPrice] Fetching crypto price',
      );

      const response = await axios.get<CryptoPriceResponse>(url, {
        timeout: 10000, // 10 seconds timeout
        headers: {
          'Accept': 'application/json',
        },
      });

      this.logger.info(
        {
          symbol,
          openPrice: response.data.openPrice,
          closePrice: response.data.closePrice,
          completed: response.data.completed,
        },
        '✅ [PolymarketCryptoPriceService] [fetchCryptoPrice] Successfully fetched crypto price',
      );

      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError;
      
      // Check if it's a rate limit error (429)
      const isRateLimit = axiosError.response?.status === 429;
      
      if (axiosError.response) {
        if (isRateLimit) {
          this.logger.warn(
            {
              symbol,
              eventStartTime,
              endDate,
              status: axiosError.response.status,
              statusText: axiosError.response.statusText,
              data: JSON.stringify(axiosError.response.data).substring(0, 500),
            },
            '⚠️ [PolymarketCryptoPriceService] [fetchCryptoPrice] Rate limit error (429) - Chainlink API error 429',
          );
        } else {
          this.logger.error(
            {
              symbol,
              eventStartTime,
              endDate,
              status: axiosError.response.status,
              statusText: axiosError.response.statusText,
              data: JSON.stringify(axiosError.response.data).substring(0, 500),
            },
            '🔴 [PolymarketCryptoPriceService] [fetchCryptoPrice] Error fetching crypto price (axios error)',
          );
        }
        
        // Throw error with status code for caller to handle
        const errorWithStatus = new Error(axiosError.message);
        (errorWithStatus as any).status = axiosError.response.status;
        (errorWithStatus as any).isRateLimit = isRateLimit;
        throw errorWithStatus;
      } else {
        this.logger.error(
          {
            symbol,
            eventStartTime,
            endDate,
            message: axiosError.message,
          },
          '🔴 [PolymarketCryptoPriceService] [fetchCryptoPrice] Error fetching crypto price (network error)',
        );
        throw axiosError;
      }
    }
  }

  /**
   * Fetch crypto price using market slug and timestamps
   * Extracts symbol from slug automatically
   * @param slug Market slug (e.g., "btc-updown-15m-1735689600")
   * @param startTimestamp Start timestamp in seconds
   * @param endTimestamp End timestamp in seconds
   * @returns CryptoPriceResponse or null if error
   */
  async fetchCryptoPriceByMarket(slug: string, startTimestamp: number, endTimestamp: number): Promise<CryptoPriceResponse | null> {
    const symbol = this.extractSymbolFromSlug(slug);
    return this.fetchCryptoPrice(symbol, startTimestamp, endTimestamp);
  }
}

