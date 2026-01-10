"""
Combined Collector - Subscribe BTC price + Orderbook, save to ClickHouse

Chạy 2 WebSocket connections song song:
1. Chainlink BTC/USD price feed
2. BTC 15m Up/Down orderbook
"""

import asyncio
import json
import time
import hashlib
from typing import Optional

from price_ws_client import PolymarketWSClient
from clob_ws_client import CLOBWSClient, fetch_btc_15m_market
from clickhouse_writer import ClickHouseWriter, PriceRecord, OrderbookRecord, PriceChangeRecord, TradeRecord

import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(levelname)s | %(message)s',
    datefmt='%H:%M:%S'
)
logger = logging.getLogger(__name__)


from dataclasses import dataclass
from typing import Dict


def _parse_timestamp_ms(ts_ms) -> float:
    """Parse timestamp từ milliseconds sang seconds. Fallback to current time."""
    try:
        return float(ts_ms) / 1000 if ts_ms else time.time()
    except (ValueError, TypeError):
        return time.time()


@dataclass
class MarketSession:
    """Represents an active market subscription (Yes asset only)"""
    client: CLOBWSClient
    market_slug: str
    asset_id: str  # Yes asset only
    market_start_time: int
    market_end_time: int
    market_hash: str  # Pre-computed hash


class CombinedCollector:
    """
    Collector kết hợp giá BTC và orderbook, lưu vào ClickHouse.
    Support overlap: listen market từ -15s đến +15s để không miss data.
    """
    
    OVERLAP_BEFORE = 15  # Subscribe market mới 15s trước khi nó bắt đầu
    OVERLAP_AFTER = 15   # Giữ market cũ 15s sau khi nó kết thúc
    
    def __init__(self):
        self.writer = ClickHouseWriter(flush_interval=2.0)
        self.price_client: Optional[PolymarketWSClient] = None
        
        # Multiple market sessions (key = market_slug)
        self.sessions: Dict[str, MarketSession] = {}
        
        # Stats
        self._price_count = 0
        self._orderbook_count = 0
        self._price_change_count = 0
        self._trade_count = 0
        self._last_stats_time = time.time()
        self._switch_count = 0
    
    async def start(self):
        """Start collector"""
        # 1. Start ClickHouse writer
        print("[1/5] Starting ClickHouse writer...", flush=True)
        await self.writer.start()
        print("[1/5] ClickHouse writer started", flush=True)
        
        # 2. Setup price client
        print("[2/5] Setting up price WS client...", flush=True)
        self.price_client = PolymarketWSClient(on_message=self._handle_price_message)
        await self.price_client.connect()
        print("[2/5] Price WS connected", flush=True)
        
        # 3. Subscribe price feeds
        print("[3/5] Subscribing to price feeds...", flush=True)
        await self.price_client.subscribe_chainlink_price()
        await self.price_client.subscribe_binance_price()
        print("[3/5] Subscribed to price feeds", flush=True)
        
        # 4. Start first market session
        print("[4/5] Starting first market session...", flush=True)
        await self._start_new_market_session()
        print("[4/5] Market session started", flush=True)
        
        # 5. Run listeners + managers
        print("", flush=True)
        print("="*60, flush=True)
        print("[5/5] Collector running... (Ctrl+C to stop)", flush=True)
        print(f"      Overlap: -{self.OVERLAP_BEFORE}s / +{self.OVERLAP_AFTER}s", flush=True)
        print("="*60, flush=True)
        print("", flush=True)
        
        await asyncio.gather(
            self.price_client.listen(),
            self._stats_loop(),
            self._market_manager_loop(),
        )
    
    async def _start_new_market_session(self, target_start_time: int = None) -> MarketSession:
        """
        Fetch market và tạo session (Yes asset only).
        
        Args:
            target_start_time: Unix timestamp của market muốn subscribe.
                              Nếu None, lấy market hiện tại.
        """
        asset_yes, _, market_slug = await fetch_btc_15m_market(start_time=target_start_time)
        
        # Tính thời điểm market
        market_start = int(market_slug.split("-")[-1])
        market_end = market_start + 900
        market_hash = hashlib.md5(market_slug.encode()).hexdigest()[:16]
        
        # Check duplicate
        if market_slug in self.sessions:
            logger.warning(f"Session already exists: {market_slug}")
            return self.sessions[market_slug]
        
        # Tạo client mới - chỉ subscribe Yes asset
        client = CLOBWSClient(on_message=self._handle_orderbook_message)
        await client.connect()
        await client.subscribe([asset_yes])
        
        session = MarketSession(
            client=client,
            market_slug=market_slug,
            asset_id=asset_yes,
            market_start_time=market_start,
            market_end_time=market_end,
            market_hash=market_hash,
        )
        
        self.sessions[market_slug] = session
        
        print(
            f"[+SESSION] {market_slug} | Asset: {asset_yes[:16]}... | "
            f"Listen: {time.strftime('%H:%M:%S', time.localtime(market_start - self.OVERLAP_BEFORE))} - "
            f"{time.strftime('%H:%M:%S', time.localtime(market_end + self.OVERLAP_AFTER))} | "
            f"Active: {len(self.sessions)}",
            flush=True
        )
        
        return session
    
    async def _stop_market_session(self, market_slug: str):
        """Stop và cleanup một market session"""
        if market_slug not in self.sessions:
            return
        
        session = self.sessions[market_slug]
        
        try:
            await session.client.unsubscribe()
            await session.client.disconnect()
        except Exception as e:
            logger.warning(f"Error stopping session {market_slug}: {e}")
        
        del self.sessions[market_slug]
        
        print(
            f"[-SESSION] {market_slug} | Active: {len(self.sessions)}",
            flush=True
        )
    
    async def _market_manager_loop(self):
        """
        Quản lý market sessions với overlap.
        
        Timeline (ví dụ market 14:00-14:15 chuyển sang 14:15-14:30):
        - 14:14:45: Subscribe market 14:15 (15s trước khi market mới bắt đầu)
        - 14:15:00: Market 14:15 officially starts
        - 14:15:15: Unsubscribe market 14:00 (15s sau khi market cũ kết thúc)
        
        Overlap window: 30s (cả 2 market đều được listen)
        """
        try:
            while True:
                now = time.time()
                
                # Tìm session có end_time gần nhất (để tính next actions)
                if not self.sessions:
                    await self._start_new_market_session()
                    continue
                
                # Lấy session có end_time nhỏ nhất (market sắp kết thúc)
                current_session = min(
                    self.sessions.values(), 
                    key=lambda s: s.market_end_time
                )
                
                # Thời điểm cần start market mới = end_time - OVERLAP_BEFORE
                next_start_time = current_session.market_end_time - self.OVERLAP_BEFORE
                
                # Thời điểm cần stop market cũ = end_time + OVERLAP_AFTER
                next_stop_time = current_session.market_end_time + self.OVERLAP_AFTER
                
                # Tính sleep time đến action gần nhất
                time_to_start = next_start_time - now
                time_to_stop = next_stop_time - now
                
                if time_to_start > 1:
                    # Chờ đến lúc start market mới
                    sleep_time = min(time_to_start, 60)  # Check mỗi 60s tối đa
                    logger.debug(f"Next market in {time_to_start:.0f}s, sleeping {sleep_time:.0f}s")
                    await asyncio.sleep(sleep_time)
                    
                elif time_to_start <= 1 and time_to_stop > 0:
                    # Đến lúc start market mới
                    # Next market start = current market end
                    next_market_start = current_session.market_end_time
                    
                    try:
                        self._switch_count += 1
                        logger.info(f"[OVERLAP START #{self._switch_count}] Starting market {next_market_start}")
                        await self._start_new_market_session(target_start_time=next_market_start)
                        
                        # Sleep đến lúc stop market cũ
                        await asyncio.sleep(self.OVERLAP_BEFORE + self.OVERLAP_AFTER + 1)
                        
                    except Exception as e:
                        logger.error(f"Failed to start new session: {e}")
                        await asyncio.sleep(5)
                        
                elif time_to_stop <= 0:
                    # Đến lúc stop market cũ
                    logger.info(f"[OVERLAP END] Stopping old market: {current_session.market_slug}")
                    await self._stop_market_session(current_session.market_slug)
                    
                else:
                    await asyncio.sleep(1)
                    
        except asyncio.CancelledError:
            pass
    
    async def stop(self):
        """Stop collector"""
        if self.price_client:
            await self.price_client.close()
        
        # Stop all market sessions
        for slug in list(self.sessions.keys()):
            await self._stop_market_session(slug)
        
        await self.writer.stop()
        
        logger.info("Collector stopped")
    
    def _handle_price_message(self, message: dict):
        """Handle Chainlink + Binance price messages"""
        msg_type = message.get("type", "")
        topic = message.get("topic", "")
        
        # Chỉ xử lý 2 topics: Chainlink và Binance
        if topic not in ("crypto_prices_chainlink", "crypto_prices"):
            return
        
        payload = message.get("payload", {})
        ts = message.get("timestamp", 0)
        
        # Update message
        if msg_type == "update":
            symbol = payload.get("symbol", "").lower()
            price = payload.get("value", 0)
            
            # Filter: chỉ lấy BTC
            if topic == "crypto_prices" and symbol != "btcusdt":
                return
            if topic == "crypto_prices_chainlink" and symbol != "btc/usd":
                return
            
            if symbol and price:
                record = PriceRecord(
                    timestamp=_parse_timestamp_ms(ts),
                    symbol=symbol,
                    price=price,
                )
                asyncio.create_task(self.writer.add_price(record))
                self._price_count += 1
        
        # Snapshot - có thể có nhiều data points
        elif msg_type == "subscribe":
            data = payload.get("data", [])
            for point in data:
                symbol = payload.get("symbol", "").lower()
                price = point.get("value", 0)
                point_ts = point.get("timestamp", ts)
                
                # Filter: chỉ lấy BTC
                if topic == "crypto_prices" and symbol != "btcusdt":
                    continue
                if topic == "crypto_prices_chainlink" and symbol != "btc/usd":
                    continue
                
                if symbol and price:
                    record = PriceRecord(
                        timestamp=_parse_timestamp_ms(point_ts),
                        symbol=symbol,
                        price=price,
                    )
                    asyncio.create_task(self.writer.add_price(record))
                    self._price_count += 1
    
    def _find_session_by_asset(self, asset_id: str) -> Optional[MarketSession]:
        """Tìm session chứa asset_id (Yes asset only)"""
        for session in self.sessions.values():
            if asset_id == session.asset_id:
                return session
        return None
    
    def _handle_orderbook_message(self, message):
        """Handle orderbook message (book + price_change + last_trade_price events)"""
        events = message if isinstance(message, list) else [message]
        
        for event in events:
            if not isinstance(event, dict):
                continue
            
            event_type = event.get("event_type", "")
            asset_id = event.get("asset_id", "")
            
            # Handle "book" event
            if event_type == "book" and asset_id:
                self._handle_book_event(event, asset_id)
            
            # Handle "price_change" event
            elif event_type == "price_change":
                self._handle_price_change_event(event)
            
            # Handle "last_trade_price" event
            elif event_type == "last_trade_price":
                self._handle_trade_event(event)
    
    def _handle_book_event(self, event: dict, asset_id: str):
        """Handle book event (full orderbook snapshot)"""
        session = self._find_session_by_asset(asset_id)
        if not session:
            return
        
        bids = event.get("bids", [])
        asks = event.get("asks", [])
        
        if not bids or not asks:
            return
        
        # Parse orderbook - dùng "in" thay vì get() để không miss price=0
        bids_price = [float(b["price"]) for b in bids if "price" in b]
        bids_size = [float(b["size"]) for b in bids if "size" in b]
        asks_price = [float(a["price"]) for a in asks if "price" in a]
        asks_size = [float(a["size"]) for a in asks if "size" in a]
        
        best_bid = max(bids_price) if bids_price else 0
        best_ask = min(asks_price) if asks_price else 0
        spread = best_ask - best_bid
        mid_price = (best_bid + best_ask) / 2
        
        record = OrderbookRecord(
            timestamp=time.time(),
            market_hash=session.market_hash,
            market_slug=session.market_slug,
            market_id=session.market_slug,
            asset_id=asset_id,
            bids_price=bids_price,
            bids_size=bids_size,
            asks_price=asks_price,
            asks_size=asks_size,
            best_bid=best_bid,
            best_ask=best_ask,
            spread=spread,
            price=mid_price,
        )
        asyncio.create_task(self.writer.add_orderbook(record))
        self._orderbook_count += 1
    
    def _handle_price_change_event(self, event: dict):
        """Handle price_change event (incremental orderbook updates)"""
        price_changes = event.get("price_changes", [])
        timestamp = _parse_timestamp_ms(event.get("timestamp", 0))
        
        # Process từng price change trong array
        for pc in price_changes:
            if not isinstance(pc, dict):
                continue
            
            asset_id = pc.get("asset_id", "")
            if not asset_id:
                continue
            
            # Tìm session cho asset này
            session = self._find_session_by_asset(asset_id)
            if not session:
                continue
            
            price = pc.get("price", 0)
            size = pc.get("size", 0)
            side = pc.get("side", "")
            order_hash = pc.get("hash", "")
            best_bid = pc.get("best_bid", 0)
            best_ask = pc.get("best_ask", 0)
            
            if not side:
                continue
            
            try:
                record = PriceChangeRecord(
                    timestamp=timestamp,
                    market_hash=session.market_hash,
                    market_slug=session.market_slug,
                    market_id=session.market_slug,
                    asset_id=asset_id,
                    price=float(price),
                    size=float(size),
                    side=side,
                    order_hash=order_hash,
                    best_bid=float(best_bid),
                    best_ask=float(best_ask),
                )
                asyncio.create_task(self.writer.add_price_change(record))
                self._price_change_count += 1
            except (ValueError, TypeError) as e:
                logger.warning(f"Invalid price_change data: {e}")
    
    def _handle_trade_event(self, event: dict):
        """Handle last_trade_price event (trade executed)"""
        asset_id = event.get("asset_id", "")
        if not asset_id:
            return
        
        # Tìm session cho asset này
        session = self._find_session_by_asset(asset_id)
        if not session:
            return
        
        timestamp = _parse_timestamp_ms(event.get("timestamp", 0))
        
        market_id = event.get("market", "")  # condition ID
        price = event.get("price", 0)
        size = event.get("size", 0)
        side = event.get("side", "")
        fee_rate_bps = event.get("fee_rate_bps", 0)
        
        if not side:
            return
        
        try:
            record = TradeRecord(
                timestamp=timestamp,
                market_hash=session.market_hash,
                market_slug=session.market_slug,
                market_id=market_id,
                asset_id=asset_id,
                price=float(price),
                size=float(size),
                side=side,
                fee_rate_bps=int(fee_rate_bps),
            )
            asyncio.create_task(self.writer.add_trade(record))
            self._trade_count += 1
        except (ValueError, TypeError) as e:
            logger.warning(f"Invalid trade data: {e}")
    
    async def _stats_loop(self):
        """Print stats mỗi 10s"""
        try:
            while True:
                await asyncio.sleep(10)
                
                writer_stats = self.writer.get_stats()
                active_markets = ", ".join(self.sessions.keys()) or "none"
                
                print(
                    f"[STATS] Markets: {len(self.sessions)} ({active_markets}) | "
                    f"Prices: {self._price_count}/{writer_stats['prices_written']} | "
                    f"OB: {self._orderbook_count}/{writer_stats['orderbooks_written']} | "
                    f"PC: {self._price_change_count}/{writer_stats['price_changes_written']} | "
                    f"Trades: {self._trade_count}/{writer_stats['trades_written']} | "
                    f"Err: {writer_stats['errors']}",
                    flush=True
                )
        except asyncio.CancelledError:
            pass


async def main():
    collector = CombinedCollector()
    
    try:
        await collector.start()
    except KeyboardInterrupt:
        logger.info("Interrupted by user")
    except Exception as e:
        logger.error(f"Error: {e}")
    finally:
        await collector.stop()


if __name__ == "__main__":
    asyncio.run(main())

