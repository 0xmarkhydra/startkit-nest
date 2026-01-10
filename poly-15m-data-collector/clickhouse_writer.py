"""
ClickHouse Writer - Async batch writer for Polymarket data
"""

import asyncio
import time
import os
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field
import aiohttp
import logging
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

logging.basicConfig(level=logging.WARNING)
logger = logging.getLogger(__name__)

# ClickHouse connection config from environment variables
CLICKHOUSE_HOST = os.getenv("CLICKHOUSE_HOST", "localhost")
CLICKHOUSE_PORT = int(os.getenv("CLICKHOUSE_PORT", "8123"))
CLICKHOUSE_USER = os.getenv("CLICKHOUSE_USER", "default")
CLICKHOUSE_PASSWORD = os.getenv("CLICKHOUSE_PASSWORD", "password")
DATABASE = os.getenv("DATABASE", "polymarket_db")


def get_clickhouse_url(user: str = CLICKHOUSE_USER, password: str = CLICKHOUSE_PASSWORD) -> str:
    """Build ClickHouse HTTP URL with auth"""
    return f"http://{CLICKHOUSE_HOST}:{CLICKHOUSE_PORT}?user={user}&password={password}"


@dataclass
class PriceRecord:
    """Record cho btc_chainlink_prices table"""
    timestamp: float  # Unix timestamp in seconds
    symbol: str
    price: float


@dataclass
class OrderbookRecord:
    """Record cho market_orderbooks_analytics table"""
    timestamp: float
    market_hash: str
    market_slug: str
    market_id: str
    asset_id: str
    bids_price: List[float]
    bids_size: List[float]
    asks_price: List[float]
    asks_size: List[float]
    best_bid: float
    best_ask: float
    spread: float
    price: float


@dataclass
class PriceChangeRecord:
    """Record cho market_price_changes table"""
    timestamp: float  # Unix timestamp in seconds
    market_hash: str
    market_slug: str
    market_id: str
    asset_id: str
    price: float  # Price level bị ảnh hưởng
    size: float  # New aggregate size tại price level đó
    side: str  # "BUY" hoặc "SELL"
    order_hash: str  # Hash của order
    best_bid: float
    best_ask: float


@dataclass
class TradeRecord:
    """Record cho market_trades table (last_trade_price events)"""
    timestamp: float  # Unix timestamp in seconds
    market_hash: str
    market_slug: str
    market_id: str  # condition ID from event
    asset_id: str
    price: float
    size: float
    side: str  # "BUY" hoặc "SELL"
    fee_rate_bps: int  # Fee rate in basis points


class ClickHouseWriter:
    """
    Async batch writer cho ClickHouse.
    
    Buffer records và flush mỗi N giây hoặc khi buffer đầy.
    """
    
    # SQL để tạo tables
    CREATE_TABLES_SQL = [
        f"CREATE DATABASE IF NOT EXISTS {DATABASE}",
        f"""
        CREATE TABLE IF NOT EXISTS {DATABASE}.btc_chainlink_prices (
            timestamp DateTime64(3),
            symbol LowCardinality(String),
            price Float64
        ) ENGINE = MergeTree()
        PARTITION BY toYYYYMMDD(timestamp)
        ORDER BY (symbol, timestamp)
        TTL timestamp + INTERVAL 30 DAY
        """,
        f"""
        CREATE TABLE IF NOT EXISTS {DATABASE}.market_orderbooks_analytics (
            timestamp DateTime64(3),
            market_hash LowCardinality(String),
            market_slug LowCardinality(String),
            market_id LowCardinality(String),
            asset_id LowCardinality(String),
            bids_price Array(Float64),
            bids_size Array(Float64),
            asks_price Array(Float64),
            asks_size Array(Float64),
            best_bid Float64,
            best_ask Float64,
            spread Float64,
            price Float64
        ) ENGINE = MergeTree()
        PARTITION BY toYYYYMMDD(timestamp)
        ORDER BY (market_slug, timestamp)
        TTL timestamp + INTERVAL 30 DAY
        """,
        f"""
        CREATE TABLE IF NOT EXISTS {DATABASE}.market_price_changes (
            timestamp DateTime64(3),
            market_hash LowCardinality(String),
            market_slug LowCardinality(String),
            market_id LowCardinality(String),
            asset_id LowCardinality(String),
            price Float64,
            size Float64,
            side LowCardinality(String),
            order_hash String,
            best_bid Float64,
            best_ask Float64
        ) ENGINE = MergeTree()
        PARTITION BY toYYYYMMDD(timestamp)
        ORDER BY (market_slug, asset_id, timestamp)
        TTL timestamp + INTERVAL 30 DAY
        """,
        f"""
        CREATE TABLE IF NOT EXISTS {DATABASE}.market_trades (
            timestamp DateTime64(3),
            market_hash LowCardinality(String),
            market_slug LowCardinality(String),
            market_id String,
            asset_id String,
            price Float64,
            size Float64,
            side LowCardinality(String),
            fee_rate_bps UInt16
        ) ENGINE = MergeTree()
        PARTITION BY toYYYYMMDD(timestamp)
        ORDER BY (market_slug, asset_id, timestamp)
        TTL timestamp + INTERVAL 30 DAY
        """,
    ]
    
    def __init__(
        self, 
        url: str = None,
        database: str = DATABASE,
        flush_interval: float = 2.0,
        max_buffer_size: int = 1000,
    ):
        self.url = url or get_clickhouse_url()
        self.database = database
        self.flush_interval = flush_interval
        self.max_buffer_size = max_buffer_size
        
        self._price_buffer: List[PriceRecord] = []
        self._orderbook_buffer: List[OrderbookRecord] = []
        self._price_change_buffer: List[PriceChangeRecord] = []
        self._trade_buffer: List[TradeRecord] = []
        self._lock = asyncio.Lock()
        self._flush_task: Optional[asyncio.Task] = None
        self._running = False
        self._session: Optional[aiohttp.ClientSession] = None
        
        # Stats
        self._prices_written = 0
        self._orderbooks_written = 0
        self._price_changes_written = 0
        self._trades_written = 0
        self._errors = 0
    
    async def _init_tables(self):
        """Tạo database và tables nếu chưa có"""
        for sql in self.CREATE_TABLES_SQL:
            success = await self._execute(sql)
            if not success:
                raise RuntimeError(f"Failed to init ClickHouse tables")
        logger.info("ClickHouse tables initialized")
    
    async def start(self):
        """Start writer và flush loop"""
        self._session = aiohttp.ClientSession()
        self._running = True
        
        # Init tables nếu chưa có
        await self._init_tables()
        
        self._flush_task = asyncio.create_task(self._flush_loop())
        logger.info(f"ClickHouse writer started (flush every {self.flush_interval}s)")
    
    async def stop(self):
        """Stop writer và flush remaining data"""
        self._running = False
        
        if self._flush_task:
            self._flush_task.cancel()
            try:
                await self._flush_task
            except asyncio.CancelledError:
                pass
        
        # Final flush
        await self._flush_all()
        
        if self._session:
            await self._session.close()
            self._session = None
        
        logger.info(
            f"ClickHouse writer stopped. "
            f"Prices: {self._prices_written}, Orderbooks: {self._orderbooks_written}, "
            f"PriceChanges: {self._price_changes_written}, Trades: {self._trades_written}, "
            f"Errors: {self._errors}"
        )
    
    async def add_price(self, record: PriceRecord):
        """Add price record to buffer"""
        async with self._lock:
            self._price_buffer.append(record)
            if len(self._price_buffer) >= self.max_buffer_size:
                await self._flush_prices()
    
    async def add_orderbook(self, record: OrderbookRecord):
        """Add orderbook record to buffer"""
        async with self._lock:
            self._orderbook_buffer.append(record)
            if len(self._orderbook_buffer) >= self.max_buffer_size:
                await self._flush_orderbooks()
    
    async def add_price_change(self, record: PriceChangeRecord):
        """Add price change record to buffer"""
        async with self._lock:
            self._price_change_buffer.append(record)
            if len(self._price_change_buffer) >= self.max_buffer_size:
                await self._flush_price_changes()
    
    async def add_trade(self, record: TradeRecord):
        """Add trade record to buffer"""
        async with self._lock:
            self._trade_buffer.append(record)
            if len(self._trade_buffer) >= self.max_buffer_size:
                await self._flush_trades()
    
    async def _flush_loop(self):
        """Background flush loop"""
        try:
            while self._running:
                await asyncio.sleep(self.flush_interval)
                await self._flush_all()
        except asyncio.CancelledError:
            pass
    
    async def _flush_all(self):
        """Flush all buffers"""
        async with self._lock:
            await self._flush_prices()
            await self._flush_orderbooks()
            await self._flush_price_changes()
            await self._flush_trades()
    
    async def _flush_prices(self):
        """Flush price buffer to ClickHouse"""
        if not self._price_buffer:
            return
        
        records = self._price_buffer
        self._price_buffer = []
        
        # Build INSERT query
        values = []
        for r in records:
            # Convert timestamp to DateTime64(3) format
            ts_ms = int(r.timestamp * 1000)
            values.append(f"({ts_ms}, '{r.symbol}', {r.price})")
        
        query = f"""
            INSERT INTO {self.database}.btc_chainlink_prices 
            (timestamp, symbol, price) VALUES {','.join(values)}
        """
        
        success = await self._execute(query)
        if success:
            self._prices_written += len(records)
            logger.debug(f"Flushed {len(records)} price records")
        else:
            self._errors += 1
    
    async def _flush_orderbooks(self):
        """Flush orderbook buffer to ClickHouse"""
        if not self._orderbook_buffer:
            return
        
        records = self._orderbook_buffer
        self._orderbook_buffer = []
        
        # Build INSERT query
        values = []
        for r in records:
            ts_ms = int(r.timestamp * 1000)
            
            # Format arrays
            bids_price_str = "[" + ",".join(str(p) for p in r.bids_price) + "]"
            bids_size_str = "[" + ",".join(str(s) for s in r.bids_size) + "]"
            asks_price_str = "[" + ",".join(str(p) for p in r.asks_price) + "]"
            asks_size_str = "[" + ",".join(str(s) for s in r.asks_size) + "]"
            
            values.append(
                f"({ts_ms}, '{r.market_hash}', '{r.market_slug}', '{r.market_id}', "
                f"'{r.asset_id}', {bids_price_str}, {bids_size_str}, "
                f"{asks_price_str}, {asks_size_str}, "
                f"{r.best_bid}, {r.best_ask}, {r.spread}, {r.price})"
            )
        
        query = f"""
            INSERT INTO {self.database}.market_orderbooks_analytics 
            (timestamp, market_hash, market_slug, market_id, asset_id,
             bids_price, bids_size, asks_price, asks_size,
             best_bid, best_ask, spread, price) 
            VALUES {','.join(values)}
        """
        
        success = await self._execute(query)
        if success:
            self._orderbooks_written += len(records)
            logger.debug(f"Flushed {len(records)} orderbook records")
        else:
            self._errors += 1
    
    async def _flush_price_changes(self):
        """Flush price change buffer to ClickHouse"""
        if not self._price_change_buffer:
            return
        
        records = self._price_change_buffer
        self._price_change_buffer = []
        
        # Build INSERT query
        values = []
        for r in records:
            ts_ms = int(r.timestamp * 1000)
            values.append(
                f"({ts_ms}, '{r.market_hash}', '{r.market_slug}', '{r.market_id}', "
                f"'{r.asset_id}', {r.price}, {r.size}, '{r.side}', '{r.order_hash}', "
                f"{r.best_bid}, {r.best_ask})"
            )
        
        query = f"""
            INSERT INTO {self.database}.market_price_changes 
            (timestamp, market_hash, market_slug, market_id, asset_id,
             price, size, side, order_hash, best_bid, best_ask) 
            VALUES {','.join(values)}
        """
        
        success = await self._execute(query)
        if success:
            self._price_changes_written += len(records)
            logger.debug(f"Flushed {len(records)} price change records")
        else:
            self._errors += 1
    
    async def _flush_trades(self):
        """Flush trade buffer to ClickHouse"""
        if not self._trade_buffer:
            return
        
        records = self._trade_buffer
        self._trade_buffer = []
        
        # Build INSERT query
        values = []
        for r in records:
            ts_ms = int(r.timestamp * 1000)
            values.append(
                f"({ts_ms}, '{r.market_hash}', '{r.market_slug}', '{r.market_id}', "
                f"'{r.asset_id}', {r.price}, {r.size}, '{r.side}', {r.fee_rate_bps})"
            )
        
        query = f"""
            INSERT INTO {self.database}.market_trades 
            (timestamp, market_hash, market_slug, market_id, asset_id,
             price, size, side, fee_rate_bps) 
            VALUES {','.join(values)}
        """
        
        success = await self._execute(query)
        if success:
            self._trades_written += len(records)
            logger.debug(f"Flushed {len(records)} trade records")
        else:
            self._errors += 1
    
    async def _execute(self, query: str) -> bool:
        """Execute query against ClickHouse"""
        if not self._session:
            return False
        
        try:
            async with self._session.post(self.url, data=query) as resp:
                if resp.status != 200:
                    text = await resp.text()
                    logger.error(f"ClickHouse error: {text[:200]}")
                    return False
                return True
        except Exception as e:
            logger.error(f"ClickHouse connection error: {e}")
            return False
    
    def get_stats(self) -> Dict[str, int]:
        """Get writer stats"""
        return {
            "prices_written": self._prices_written,
            "orderbooks_written": self._orderbooks_written,
            "price_changes_written": self._price_changes_written,
            "trades_written": self._trades_written,
            "errors": self._errors,
            "price_buffer": len(self._price_buffer),
            "orderbook_buffer": len(self._orderbook_buffer),
            "price_change_buffer": len(self._price_change_buffer),
            "trade_buffer": len(self._trade_buffer),
        }

