"""
Polymarket WebSocket Client - Subscribe to crypto prices from Chainlink
"""

import asyncio
import json
import websockets
from typing import Callable, Optional
import logging

logging.basicConfig(level=logging.WARNING)  # Chỉ log warnings/errors
logger = logging.getLogger(__name__)

POLYMARKET_WS_URL = "wss://ws-live-data.polymarket.com/"

HEADERS = {
    "Origin": "https://polymarket.com",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
}


class PolymarketWSClient:
    PING_INTERVAL = 5  # Polymarket cần PING mỗi 5s
    
    def __init__(self, on_message: Optional[Callable] = None):
        self.ws = None
        self.on_message = on_message or self._default_handler
        self._running = False
        self._ping_task = None

    async def connect(self):
        """Kết nối WebSocket"""
        logger.info(f"Connecting to {POLYMARKET_WS_URL}")
        self.ws = await websockets.connect(
            POLYMARKET_WS_URL,
            additional_headers=HEADERS,
            ping_interval=None,  # Disable auto ping, dùng manual PING
            ping_timeout=None,
        )
        logger.info("Connected!")
        self._running = True
        # Start PING loop
        self._ping_task = asyncio.create_task(self._ping_loop())
    
    async def _ping_loop(self):
        """Gửi PING mỗi 5s để giữ connection"""
        try:
            while self._running and self.ws:
                await asyncio.sleep(self.PING_INTERVAL)
                if self.ws and self._running:
                    try:
                        # QUAN TRỌNG: Ping phải là JSON, không phải plain text
                        await self.ws.send(json.dumps({"action": "ping"}))
                        logger.debug("Sent PING")
                    except Exception as e:
                        logger.warning(f"Ping failed: {e}")
                        break
        except asyncio.CancelledError:
            pass
    
    async def subscribe_binance_price(self, symbols: list = None):
        """
        Subscribe Binance price feed (faster, spot exchange).
        symbols: ["btcusdt", "ethusdt", "solusdt"] hoặc None = all
        
        Binance feed nhanh hơn Chainlink → dùng cho latency arbitrage
        """
        sub = {
            "topic": "crypto_prices",
            "type": "update",
        }
        # NOTE: Docs nói filter là plain string "btcusdt,ethusdt"
        # Nhưng server reject với regex error → subscribe ALL, filter trong handler
        # Ref: https://docs.polymarket.com/developers/RTDS/RTDS-crypto-prices
        
        payload = {"action": "subscribe", "subscriptions": [sub]}
        await self._send(payload)
        logger.info(f"Subscribed to Binance prices: {symbols or 'all'}")
    
    async def subscribe_chainlink_price(self, symbol: str = None):
        """
        Subscribe Chainlink oracle feed.
        symbol: "btc/usd", "eth/usd" hoặc None = all
        """
        # Format đúng theo code hoạt động: type = "update", không cần filters
        sub = {
            "topic": "crypto_prices_chainlink",
            "type": "update",
        }
        
        payload = {"action": "subscribe", "subscriptions": [sub]}
        await self._send(payload)
        logger.info(f"Subscribed to Chainlink prices")

    async def subscribe_orderbook(self, asset_id: str):
        """Subscribe orderbook updates cho một asset"""
        payload = {
            "action": "subscribe",
            "subscriptions": [
                {
                    "topic": "book",
                    "type": "update",
                    "filters": json.dumps({"asset_id": asset_id}),
                }
            ],
        }
        await self._send(payload)
        logger.info(f"Subscribed to orderbook: {asset_id[:16]}...")

    async def subscribe_trades(self, asset_id: str):
        """Subscribe trade updates"""
        payload = {
            "action": "subscribe",
            "subscriptions": [
                {
                    "topic": "trades",
                    "type": "update",
                    "filters": json.dumps({"asset_id": asset_id}),
                }
            ],
        }
        await self._send(payload)
        logger.info(f"Subscribed to trades: {asset_id[:16]}...")

    async def _send(self, payload: dict):
        """Gửi message"""
        if self.ws:
            await self.ws.send(json.dumps(payload))

    def _default_handler(self, message: dict):
        """Handler mặc định - in ra thông tin quan trọng"""
        import datetime
        
        msg_type = message.get("type", "unknown")
        topic = message.get("topic", "unknown")
        ts = message.get("timestamp", 0)
        
        # Format timestamp
        if ts:
            dt = datetime.datetime.fromtimestamp(ts / 1000)
            ts_str = dt.strftime("%H:%M:%S")
        else:
            ts_str = "N/A"
        
        # Extract price data
        payload = message.get("payload", {})
        data = payload.get("data", [])
        symbol = payload.get("symbol", "")
        
        if data:
            latest = data[-1]
            price = latest.get("value", 0)
            logger.info(
                f"[{ts_str}] {msg_type.upper()} | {topic} | {symbol} | "
                f"Latest: ${price:,.2f} | Points: {len(data)}"
            )
        else:
            logger.info(f"[{ts_str}] {msg_type.upper()} | {topic} | No data")

    async def listen(self):
        """Lắng nghe messages"""
        try:
            async for raw_msg in self.ws:
                
                # Skip empty messages
                if not raw_msg or not raw_msg.strip():
                    continue
                
                try:
                    message = json.loads(raw_msg)
                    self.on_message(message)
                except json.JSONDecodeError:
                    logger.warning(f"Invalid JSON: {raw_msg[:100]}")
        except websockets.ConnectionClosed as e:
            logger.error(f"Connection closed: code={e.code}, reason={e.reason}")
            self._running = False
        except Exception as e:
            logger.error(f"Listen error: {type(e).__name__}: {e}")
            self._running = False

    async def close(self):
        """Đóng kết nối"""
        self._running = False
        
        # Cancel ping task
        if self._ping_task:
            self._ping_task.cancel()
            try:
                await self._ping_task
            except asyncio.CancelledError:
                pass
            self._ping_task = None
        
        # Close WebSocket
        if self.ws:
            try:
                await self.ws.close()
            except:
                pass
            self.ws = None
        
        logger.info("Connection closed")


async def main():
    """Demo: Subscribe BTC price từ cả Binance (nhanh) và Chainlink (oracle)"""
    import sys
    import datetime
    
    msg_count = 0
    binance_count = 0
    chainlink_count = 0
    
    # Track prices để so sánh latency
    last_binance = {"price": 0, "ts": 0}
    last_chainlink = {"price": 0, "ts": 0}
    
    def price_handler(message: dict):
        nonlocal msg_count, binance_count, chainlink_count
        msg_count += 1
        
        msg_type = message.get("type", "unknown")
        topic = message.get("topic", "")
        msg_ts = message.get("timestamp", 0)  # WS send time
        
        payload = message.get("payload", {})
        symbol = payload.get("symbol", "").lower()
        price = payload.get("value", 0)
        payload_ts = payload.get("timestamp", 0)  # Actual price time
        
        # Format timestamp
        if payload_ts:
            dt = datetime.datetime.fromtimestamp(payload_ts / 1000)
            ts_str = dt.strftime("%H:%M:%S.%f")[:-3]
        else:
            ts_str = "N/A"
        
        # Binance feed - FAST
        if topic == "crypto_prices" and msg_type == "update":
            if symbol == "btcusdt":
                binance_count += 1
                last_binance["price"] = price
                last_binance["ts"] = payload_ts
                
                # Calculate latency if we have chainlink price
                lag_info = ""
                if last_chainlink["price"] > 0:
                    price_diff = price - last_chainlink["price"]
                    pct = (price_diff / last_chainlink["price"]) * 100
                    lag_info = f" | vs CL: {price_diff:+.2f} ({pct:+.3f}%)"
                
                print(f"[BINANCE #{binance_count:4d}] [{ts_str}] ${price:,.2f}{lag_info}", flush=True)
        
        # Chainlink feed - SLOW (oracle)
        elif topic == "crypto_prices_chainlink" and msg_type == "update":
            if symbol == "btc/usd":
                chainlink_count += 1
                last_chainlink["price"] = price
                last_chainlink["ts"] = payload_ts
                
                # Calculate latency vs Binance
                lag_info = ""
                if last_binance["ts"] > 0 and payload_ts > 0:
                    lag_ms = last_binance["ts"] - payload_ts
                    lag_info = f" | lag: {lag_ms:+.0f}ms"
                
                print(f"[CHAINLK #{chainlink_count:4d}] [{ts_str}] ${price:,.2f}{lag_info}", flush=True)
        
        # Snapshot (initial data)
        elif msg_type == "subscribe":
            data = payload.get("data", [])
            if data:
                latest = data[-1]
                snap_price = latest.get("value", 0)
                print(f"[SNAPSHOT] [{ts_str}] {topic}: ${snap_price:,.2f} | {len(data)} points", flush=True)
    
    client = PolymarketWSClient(on_message=price_handler)
    
    try:
        await client.connect()
        
        # Subscribe cả 2 feeds (filter trong handler vì server không accept filter format)
        await client.subscribe_binance_price()    # All symbols, filter btcusdt trong handler
        await client.subscribe_chainlink_price()  # Oracle feed
        
        print("\n" + "="*70, flush=True)
        print("Comparing Binance (fast) vs Chainlink (oracle) for BTC", flush=True)
        print("Binance should lead Chainlink by 100-500ms → arbitrage edge", flush=True)
        print("="*70 + "\n", flush=True)
        
        await client.listen()
    except KeyboardInterrupt:
        logger.info("Interrupted by user")
    finally:
        await client.close()
        print(f"\nTotal: {msg_count} msgs | Binance: {binance_count} | Chainlink: {chainlink_count}", flush=True)


if __name__ == "__main__":
    asyncio.run(main())

