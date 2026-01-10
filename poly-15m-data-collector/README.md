# Poly 15m Data Collector

Collector real-time data từ Polymarket BTC 15-minute markets, lưu vào ClickHouse.

## Data thu thập

| Table | Nguồn | Mô tả |
|-------|-------|-------|
| `btc_chainlink_prices` | Chainlink + Binance | Giá BTC real-time |
| `market_orderbooks_analytics` | CLOB WS | Full orderbook snapshots |
| `market_price_changes` | CLOB WS | Incremental orderbook updates |
| `market_trades` | CLOB WS | Trades executed |

## Chạy

```bash
# 1. Setup
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 2. Config ClickHouse
cp .env.example .env
# Edit .env với ClickHouse credentials

# 3. Run
python main.py
```

## Lưu ý

- **Overlap**: Subscribe market mới 15s trước khi bắt đầu, giữ market cũ 15s sau khi kết thúc
- **TTL**: Data tự động xóa sau 30 ngày
- **Only Yes asset**: Chỉ collect Yes side của market (No = 1 - Yes)

