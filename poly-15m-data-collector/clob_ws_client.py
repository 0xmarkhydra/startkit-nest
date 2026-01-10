"""
Polymarket CLOB WebSocket Client - Subscribe to orderbook updates
"""

import asyncio
import json
import time
import websockets
from typing import Callable, Optional, List, Dict
import logging

logging.basicConfig(level=logging.WARNING)
logger = logging.getLogger(__name__)

CLOB_WS_URL = "wss://ws-subscriptions-clob.polymarket.com/ws/market"


class CLOBWSClient:
    """
    WebSocket client cho Polymarket CLOB (orderbook data).
    
    Khác với PolymarketWSClient:
    - Endpoint: wss://ws-subscriptions-clob.polymarket.com/ws/market
    - Ping: plain text "PING" (không phải JSON)
    - Subscribe: {"assets_ids": [...], "type": "market"}
    """
    
    PING_INTERVAL = 10
    
    # Reconnect settings
    RECONNECT_BASE_DELAY = 1.0  # seconds
    RECONNECT_MAX_DELAY = 60.0  # max 60s between retries
    RECONNECT_MAX_RETRIES = 10  # 0 = unlimited
    
    def __init__(self, on_message: Optional[Callable] = None, auto_reconnect: bool = True):
        self.ws = None
        self.on_message = on_message or self._default_handler
        self._running = False
        self._ping_task = None
        self._listen_task = None  # Track listen task
        self._asset_ids: List[str] = []
        self._auto_reconnect = auto_reconnect
        self._reconnect_count = 0
    
    async def connect(self):
        """Kết nối WebSocket"""
        logger.info(f"Connecting to {CLOB_WS_URL}")
        self.ws = await websockets.connect(CLOB_WS_URL)
        self._running = True
        self._reconnect_count = 0  # Reset on successful connect
        self._ping_task = asyncio.create_task(self._ping_loop())
        logger.info("Connected!")
    
    async def _reconnect(self) -> bool:
        """
        Thử reconnect với exponential backoff.
        Returns True nếu reconnect thành công.
        """
        if not self._auto_reconnect:
            return False
        
        # Cleanup old connection
        if self._ping_task:
            self._ping_task.cancel()
            try:
                await self._ping_task
            except asyncio.CancelledError:
                pass
            self._ping_task = None
        
        if self.ws:
            try:
                await self.ws.close()
            except:
                pass
            self.ws = None
        
        saved_asset_ids = self._asset_ids.copy()
        
        while self._running:
            self._reconnect_count += 1
            
            # Check max retries
            if self.RECONNECT_MAX_RETRIES > 0 and self._reconnect_count > self.RECONNECT_MAX_RETRIES:
                logger.error(f"Max reconnect retries ({self.RECONNECT_MAX_RETRIES}) exceeded")
                return False
            
            # Exponential backoff: 1, 2, 4, 8, 16, 32, 60, 60, ...
            delay = min(
                self.RECONNECT_BASE_DELAY * (2 ** (self._reconnect_count - 1)),
                self.RECONNECT_MAX_DELAY
            )
            logger.warning(f"Reconnecting in {delay:.1f}s (attempt {self._reconnect_count})...")
            
            await asyncio.sleep(delay)
            
            if not self._running:
                return False
            
            try:
                self.ws = await websockets.connect(CLOB_WS_URL)
                self._ping_task = asyncio.create_task(self._ping_loop())
                logger.info(f"Reconnected after {self._reconnect_count} attempts")
                
                # Re-subscribe
                if saved_asset_ids:
                    await self.subscribe(saved_asset_ids)
                    logger.info(f"Re-subscribed to {len(saved_asset_ids)} assets")
                
                self._reconnect_count = 0
                return True
                
            except Exception as e:
                logger.warning(f"Reconnect failed: {type(e).__name__}: {e}")
        
        return False
    
    async def _ping_loop(self):
        """Gửi PING mỗi 10s để giữ connection"""
        try:
            while self._running and self.ws:
                await asyncio.sleep(self.PING_INTERVAL)
                if self.ws and self._running:
                    try:
                        await self.ws.send("PING")
                        logger.debug("Sent PING")
                    except Exception as e:
                        logger.warning(f"Ping failed: {e}")
                        break
        except asyncio.CancelledError:
            pass
    
    async def subscribe(self, asset_ids: List[str]):
        """
        Subscribe orderbook updates cho assets.
        Tự động start listen loop (giống architecture source cũ).
        
        Args:
            asset_ids: List of asset IDs (token IDs từ market)
        """
        if not self.ws:
            raise RuntimeError("WebSocket not connected")
        
        self._asset_ids = asset_ids
        
        sub_msg = {
            "assets_ids": asset_ids,
            "type": "market"
        }
        await self.ws.send(json.dumps(sub_msg))
        logger.info(f"Subscribed to {len(asset_ids)} assets")
        
        # Start listen loop (giống source cũ)
        self._running = True
        self._listen_task = asyncio.create_task(self._listen_loop())
    
    async def _listen_loop(self):
        """Listen loop - tự động chạy khi subscribe()"""
        try:
            async for raw_msg in self.ws:
                if not self._running:
                    break
                
                if raw_msg == "PONG":
                    continue
                
                if not raw_msg or not raw_msg.strip():
                    continue
                
                try:
                    message = json.loads(raw_msg)
                    self.on_message(message)
                except json.JSONDecodeError:
                    logger.warning(f"Invalid JSON: {raw_msg[:100]}")
                    
        except Exception as e:
            logger.error(f"Listen error: {type(e).__name__}: {e}")
        finally:
            logger.debug("Listen loop stopped")
    
    async def unsubscribe(self):
        """Unsubscribe khỏi assets và stop listen loop"""
        if not self.ws or not self._asset_ids:
            return
        
        # Đúng format theo docs: dùng "action": "unsubscribe"
        unsub_msg = {
            "action": "unsubscribe",
            "assets_ids": self._asset_ids,
            "type": "market"
        }
        try:
            await self.ws.send(json.dumps(unsub_msg))
            logger.info(f"Unsubscribed from {len(self._asset_ids)} assets")
        except Exception as e:
            logger.warning(f"Unsubscribe failed: {e}")
        
        self._asset_ids = []
        
        # Stop listen loop
        self._running = False
        if self._listen_task:
            self._listen_task.cancel()
            try:
                await self._listen_task
            except asyncio.CancelledError:
                pass
            self._listen_task = None
    
    def _default_handler(self, message: dict):
        """Handler mặc định - in ra thông tin quan trọng"""
        if isinstance(message, list):
            for event in message:
                self._handle_event(event)
        else:
            self._handle_event(message)
    
    def _handle_event(self, event: dict):
        """Xử lý single event"""
        event_type = event.get("event_type", "unknown")
        asset_id = event.get("asset_id", "")[:8]
        
        if event_type == "book":
            bids = event.get("bids", [])
            asks = event.get("asks", [])
            best_bid = max(float(b["price"]) for b in bids) if bids else 0
            best_ask = min(float(a["price"]) for a in asks) if asks else 0
            logger.info(f"[BOOK] {asset_id} | Bid: {best_bid:.3f} | Ask: {best_ask:.3f}")
        
        elif event_type == "price_change":
            price = event.get("price", 0)
            logger.info(f"[PRICE] {asset_id} | {price:.3f}")
    
    async def listen(self):
        """Lắng nghe messages với auto-reconnect"""
        while self._running:
            if not self.ws:
                if not await self._reconnect():
                    break
                continue
            
            try:
                async for raw_msg in self.ws:
                    if raw_msg == "PONG":
                        continue
                    
                    if not raw_msg or not raw_msg.strip():
                        continue
                    
                    try:
                        message = json.loads(raw_msg)
                        self.on_message(message)
                    except json.JSONDecodeError:
                        logger.warning(f"Invalid JSON: {raw_msg[:100]}")
                        
            except websockets.ConnectionClosed as e:
                logger.error(f"Connection closed: code={e.code}, reason={e.reason}")
                if self._running and self._auto_reconnect:
                    if not await self._reconnect():
                        break
                else:
                    break
                    
            except Exception as e:
                logger.error(f"Listen error: {type(e).__name__}: {e}")
                if self._running and self._auto_reconnect:
                    if not await self._reconnect():
                        break
                else:
                    break
    
    async def disconnect(self):
        """
        Disconnect WebSocket (giống source cũ).
        Khác với close() - method này chỉ cleanup connection, không set _running=False global.
        """
        # Stop listen task nếu có
        if self._listen_task:
            self._running = False
            self._listen_task.cancel()
            try:
                await self._listen_task
            except asyncio.CancelledError:
                pass
            self._listen_task = None
        
        # Stop ping task
        if self._ping_task:
            self._ping_task.cancel()
            try:
                await self._ping_task
            except asyncio.CancelledError:
                pass
            self._ping_task = None
        
        # Close WS connection
        if self.ws:
            try:
                await self.ws.close()
            except:
                pass
            self.ws = None
        
        logger.info("WebSocket disconnected")
    
    async def close(self):
        """Đóng kết nối (backward compatibility)"""
        await self.disconnect()


async def fetch_btc_15m_market(start_time: int = None) -> tuple:
    """
    Fetch BTC 15m market từ Gamma API.
    
    Args:
        start_time: Unix timestamp của market start time.
                   Nếu None, lấy market hiện tại.
    
    Returns:
        (asset_yes, asset_no, slug)
    """
    import aiohttp
    
    if start_time is None:
        now = int(time.time())
        start_time = (now // 900) * 900
    
    slug = f"btc-updown-15m-{start_time}"
    
    async with aiohttp.ClientSession() as session:
        url = f"https://gamma-api.polymarket.com/markets/slug/{slug}"
        async with session.get(url) as resp:
            if resp.status != 200:
                raise Exception(f"Market not found: {slug}")
            
            data = await resp.json()
            
            # Market có thể chưa active nếu fetch trước start time
            # Chỉ check token IDs, không check active
            
            token_ids = data.get("clobTokenIds", [])
            if isinstance(token_ids, str):
                token_ids = json.loads(token_ids)
            
            if len(token_ids) != 2:
                raise Exception(f"Invalid token IDs: {token_ids}")
            
            return token_ids[0], token_ids[1], slug


async def main():
    """Demo: Subscribe BTC 15m Up/Down orderbook"""
    
    # State
    orderbooks: Dict[str, dict] = {}
    update_count = 0
    asset_up = None
    asset_down = None
    
    def orderbook_handler(message):
        nonlocal update_count
        
        events = message if isinstance(message, list) else [message]
        
        for event in events:
            if not isinstance(event, dict):
                continue
            
            event_type = event.get("event_type", "")
            asset_id = event.get("asset_id", "")
            
            if event_type == "book" and asset_id:
                bids = event.get("bids", [])
                asks = event.get("asks", [])
                
                if bids and asks:
                    best_bid = max(float(b["price"]) for b in bids)
                    best_ask = min(float(a["price"]) for a in asks)
                    spread = best_ask - best_bid
                    
                    # Tính depth (sum of sizes)
                    bid_depth = sum(float(b["size"]) * float(b["price"]) for b in bids)
                    ask_depth = sum(float(a["size"]) * float(a["price"]) for a in asks)
                    
                    orderbooks[asset_id] = {
                        "best_bid": best_bid,
                        "best_ask": best_ask,
                        "spread": spread,
                        "bid_depth": bid_depth,
                        "ask_depth": ask_depth,
                        "levels": (len(bids), len(asks)),
                    }
                    
                    update_count += 1
                    
                    # Print
                    side = "UP  " if asset_id == asset_up else "DOWN"
                    ratio = bid_depth / ask_depth if ask_depth > 0 else 0
                    print(
                        f"[{side}] Bid: {best_bid:.3f} | Ask: {best_ask:.3f} | "
                        f"Spread: {spread:.3f} | Depth: ${bid_depth:.0f}/${ask_depth:.0f} | "
                        f"Ratio: {ratio:.2f}x",
                        flush=True
                    )
    
    # Fetch market
    print("[*] Fetching BTC 15m market...", flush=True)
    try:
        asset_up, asset_down, slug = await fetch_btc_15m_market()
        print(f"[+] Market: {slug}", flush=True)
        print(f"    UP:   {asset_up[:16]}...", flush=True)
        print(f"    DOWN: {asset_down[:16]}...", flush=True)
    except Exception as e:
        print(f"[!] Error: {e}", flush=True)
        return
    
    # Connect
    client = CLOBWSClient(on_message=orderbook_handler)
    
    try:
        await client.connect()
        await client.subscribe([asset_up, asset_down])
        
        print("\n" + "="*60, flush=True)
        print("Listening for orderbook updates...", flush=True)
        print("="*60 + "\n", flush=True)
        
        await client.listen()
    except KeyboardInterrupt:
        print("\n[*] Interrupted", flush=True)
    finally:
        await client.close()
        print(f"\nTotal: {update_count} orderbook updates", flush=True)


if __name__ == "__main__":
    asyncio.run(main())

