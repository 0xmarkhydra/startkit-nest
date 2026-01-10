# Tài Liệu Logic - Dual Market Raw Data Collector

## Tổng Quan

Hệ thống này là một **Collector thu thập dữ liệu real-time từ Polymarket** thông qua WebSocket. Hệ thống được thiết kế để thu thập dữ liệu từ **2 markets đồng thời** (market hiện tại và market sắp tới) nhằm đảm bảo không bỏ sót dữ liệu khi market chuyển giao.

### Mục Đích Chính
- Thu thập và lưu trữ tất cả raw messages từ Polymarket WebSocket
- Theo dõi 2 markets đồng thời (current + upcoming) để đảm bảo coverage liên tục
- Tự động chuyển đổi khi market kết thúc (market lifecycle management)
- Lưu trữ dữ liệu vào PostgreSQL với batch insert để tối ưu hiệu suất

## Luồng Hoạt Động Chính

### 1. Khởi Động Hệ Thống (Startup Flow)

Khi chạy `index.js`, hệ thống thực hiện các bước sau:

```
1. Khởi tạo Database
   ├─> Kết nối PostgreSQL
   ├─> Tạo table ws_raw_messages (nếu chưa có)
   ├─> Tạo table market_registry (nếu chưa có)
   └─> Tạo indexes để tối ưu query

2. Tạo WebSocket Collector
   ├─> Khởi tạo WSCollector instance
   ├─> Kết nối đến Polymarket WebSocket
   │   └─> URL: wss://ws-subscriptions-clob.polymarket.com/ws/market
   └─> Bắt đầu ping loop (gửi PING mỗi 10 giây để keep-alive)

3. Tạo Market Manager
   ├─> Khởi tạo MarketManager với reference đến WSCollector
   └─> MarketManager sẽ quản lý lifecycle của markets

4. Khởi tạo Market Manager
   ├─> Fetch Current Market (A)
   │   ├─> Tính toán timestamp hiện tại (làm tròn xuống bội số 900 giây = 15 phút)
   │   ├─> Tạo slug: "btc-updown-15m-{timestamp}"
   │   ├─> Gọi Polymarket Gamma API để lấy thông tin market
   │   └─> Parse dữ liệu: conditionId, assetYesId, assetNoId, timestamps
   │
   └─> Fetch Upcoming Market (B)
       ├─> Tính toán: next market = current market endTimestamp
       ├─> Tạo slug tương ứng
       └─> Gọi API để lấy thông tin market B

5. Lưu vào Database
   ├─> Lưu market A vào market_registry với status = "active"
   └─> Lưu market B vào market_registry với status = "upcoming"

6. Subscribe WebSocket
   ├─> Subscribe market A (assetYesId + assetNoId)
   │   └─> Gửi message: { assets_ids: [...], type: "market" }
   │
   └─> Subscribe market B (assetYesId + assetNoId)
       └─> Gửi message với tất cả assets đã subscribe (bao gồm A và B)

7. Lập lịch Overlap Subscription
   └─> Tính toán thời gian: 30 giây trước khi market A kết thúc
       └─> Set timeout để subscribe market C (market sau B)

8. Bắt đầu Monitor Loop
   └─> Kiểm tra mỗi 5 giây: current market đã kết thúc chưa?
       └─> Nếu đã kết thúc → Thực hiện promote markets
```

### 2. Xử Lý Messages Từ WebSocket

Khi WebSocket nhận được message, `WSCollector.handleMessage()` xử lý như sau:

```
Message Nhận Được
    │
    ├─> Bỏ qua nếu là "PONG" (response từ PING)
    │
    ├─> Bỏ qua nếu là array rỗng [] (subscribe response)
    │
    ├─> Parse JSON
    │
    ├─> Xác định event_type từ raw_data
    │
    ├─> TRƯỜNG HỢP 1: last_trade_price event
    │   ├─> asset_id nằm ở root level của message
    │   ├─> Tra cứu asset_id trong assetToMarketMap
    │   │   └─> Lấy market_slug và market_status tương ứng
    │   └─> Đưa vào queue: saveRawMessage(marketSlug, assetId, "last_trade_price", status, data)
    │
    ├─> TRƯỜNG HỢP 2: price_change event
    │   ├─> asset_id nằm trong price_changes array
    │   ├─> Loop qua từng item trong price_changes
    │   ├─> Với mỗi item, tra cứu asset_id trong assetToMarketMap
    │   └─> Đưa vào queue: saveRawMessage(...)
    │
    └─> TRƯỜNG HỢP 3: event khác
        └─> Lưu với market_slug = null, asset_id = null (nếu không xác định được)
```

**Lưu ý quan trọng:**
- `assetToMarketMap` được cập nhật khi subscribe/unsubscribe
- Mỗi asset_id được map đến một object `{slug, status}` để biết asset thuộc market nào
- Nếu không tìm thấy asset_id trong map → market_slug và market_status = null/unknown

### 3. Batch Insert Queue (Tối Ưu Database)

Hệ thống sử dụng queue-based batch insert để tránh insert từng message một (chậm):

```
saveRawMessage() được gọi
    │
    ├─> Push message vào messageQueue
    │
    ├─> KIỂM TRA: queue.length >= 100?
    │   ├─> Nếu CÓ → Xử lý batch ngay lập tức
    │   │
    │   └─> Nếu KHÔNG → Kiểm tra có timer chưa?
    │       ├─> Nếu chưa có → Set timer 1 giây
    │       └─> Nếu có rồi → Đợi timer hoặc khi đủ 100
    │
    └─> processBatch() được gọi
        ├─> Lấy 100 messages (hoặc tất cả nếu < 100)
        ├─> Tạo bulk INSERT query với nhiều VALUES
        │   └─> INSERT INTO ws_raw_messages VALUES (row1), (row2), ..., (rowN)
        ├─> Thực hiện query (single transaction)
        ├─> Nếu thành công → Log và tiếp tục
        └─> Nếu thất bại → Đưa lại vào queue (có giới hạn 10000 để tránh overflow)
```

**Lợi ích:**
- Giảm số lượng queries đến database (từ N queries → N/100 queries)
- Tăng throughput đáng kể
- Non-blocking: messages được queue và insert trong background

### 4. Quản Lý Market Lifecycle

`MarketManager` quản lý việc chuyển đổi giữa các markets:

#### 4.1. Overlap Subscription (30 giây trước khi market kết thúc)

```
Khi còn 30 giây trước khi current market kết thúc:
    │
    ├─> Fetch market C (market sau upcoming market B)
    │   └─> Tính: C = upcomingMarket.endTimestamp
    │
    ├─> Subscribe market B (upcoming market)
    │   └─> Thêm assetYesId và assetNoId của B vào subscription
    │   └─> Cập nhật assetToMarketMap
    │
    └─> Lưu market C vào registry với status = "upcoming"
```

**Tại sao cần overlap?**
- Đảm bảo không bỏ sót dữ liệu khi market chuyển giao
- Market B có thể bắt đầu nhận data sớm, nên subscribe trước để capture hết

#### 4.2. Market Promotion (Khi market kết thúc)

Monitor loop kiểm tra mỗi 5 giây:

```
Monitor Loop (mỗi 5 giây)
    │
    ├─> Kiểm tra: now >= currentMarket.endTimestamp?
    │
    └─> Nếu CÓ → Thực hiện promote:
        │
        ├─> UNSUBSCRIBE Market A (current market đã kết thúc)
        │   ├─> Xóa assetYesId và assetNoId của A khỏi subscribedAssets
        │   ├─> Xóa khỏi assetToMarketMap
        │   ├─> Re-subscribe với assets còn lại (B và C nếu có)
        │   └─> Cập nhật database: status A = "ended", unsubscribed_at = NOW()
        │
        ├─> PROMOTE Markets
        │   ├─> currentMarket = upcomingMarket (B trở thành current)
        │   └─> Fetch market mới: upcomingMarket = C
        │
        ├─> Lưu vào Database
        │   ├─> Cập nhật B: status = "active"
        │   └─> Lưu C: status = "upcoming"
        │
        ├─> Subscribe Market C (upcoming mới)
        │   └─> Thêm assets của C vào subscription
        │
        └─> Lập lịch lại Overlap Subscription
            └─> Tính toán: 30 giây trước khi B (current mới) kết thúc
```

**Chu kỳ Market:**
```
Time:    0s -------- 870s -------- 900s -------- 1770s -------- 1800s
         │                          │                          │
Market A: [====== ACTIVE ======] ENDED
Market B:           [====== UPCOMING → ACTIVE ======] ENDED
Market C:                               [====== UPCOMING → ACTIVE ======]
          │                          │                          │
          Subscribe B           Promote: A→B, B→C          Promote tiếp theo
          (overlap)
```

### 5. Cấu Trúc Dữ Liệu Trong Database

#### 5.1. Table: `ws_raw_messages`

Lưu tất cả raw messages từ WebSocket:

```sql
ws_raw_messages:
  - id: Serial (auto-increment)
  - market_slug: VARCHAR(255) - Slug của market (có thể NULL nếu không xác định được)
  - asset_id: VARCHAR(255) - Asset ID (có thể NULL)
  - event_type: VARCHAR(50) - "last_trade_price" | "price_change" | "unknown"
  - market_status: VARCHAR(20) - "active" | "upcoming" | "ended" | "unknown"
  - raw_data: JSONB - Toàn bộ raw message từ WebSocket (không modify)
  - received_at: TIMESTAMP - Thời điểm nhận message
  - created_at: TIMESTAMP - Thời điểm insert vào DB
```

**Indexes:**
- `idx_ws_raw_market`: market_slug (để query theo market)
- `idx_ws_raw_asset`: asset_id (để query theo asset)
- `idx_ws_raw_received`: received_at DESC (để query messages mới nhất)
- `idx_ws_raw_status`: market_status (để filter theo status)

#### 5.2. Table: `market_registry`

Lưu thông tin về các markets đã/đang subscribe:

```sql
market_registry:
  - id: Serial
  - slug: VARCHAR(255) UNIQUE - Market slug (primary identifier)
  - condition_id: VARCHAR(255) - Polymarket condition ID
  - asset_yes_id: VARCHAR(255) - YES token asset ID
  - asset_no_id: VARCHAR(255) - NO token asset ID
  - start_timestamp: BIGINT - Unix timestamp (seconds)
  - end_timestamp: BIGINT - Unix timestamp (seconds)
  - status: VARCHAR(20) - "active" | "upcoming" | "ended"
  - subscribed_at: TIMESTAMP - Khi nào subscribe
  - unsubscribed_at: TIMESTAMP - Khi nào unsubscribe (NULL nếu chưa)
  - created_at: TIMESTAMP
  - updated_at: TIMESTAMP
```

**Indexes:**
- `idx_market_status`: status (để query markets đang active/upcoming)
- `idx_market_start`: start_timestamp (để query theo thời gian)

### 6. Xử Lý Các Loại Event Từ WebSocket

#### 6.1. Last Trade Price Event

**Cấu trúc message:**
```json
{
  "event_type": "last_trade_price",
  "asset_id": "0xabc123...",
  "price": "0.65",
  "timestamp": 1735689610
}
```

**Xử lý:**
- `asset_id` nằm ở root level
- Tra cứu trong `assetToMarketMap` để lấy market_slug và status
- Lưu vào queue

#### 6.2. Price Change Event

**Cấu trúc message:**
```json
{
  "event_type": "price_change",
  "price_changes": [
    {
      "asset_id": "0xabc123...",
      "price": "0.65",
      "best_ask": "0.66",
      "best_bid": "0.64",
      "asks_size": "1000",
      "bids_size": "2000"
    }
  ],
  "timestamp": 1735689610
}
```

**Xử lý:**
- Loop qua `price_changes` array
- Với mỗi item, extract `asset_id`
- Tra cứu market và lưu vào queue

**Lưu ý:** Một price_change event có thể chứa nhiều assets (nhưng thường chỉ có 1)

### 7. Tính Toán Market Slug

Hệ thống sử dụng pattern cố định để tạo market slug:

```javascript
// Format: "btc-updown-15m-{timestamp}"
// Ví dụ: "btc-updown-15m-1735689600"

// Tính toán current market:
const now = Math.floor(Date.now() / 1000);
const currentStart = Math.floor(now / 900) * 900; // Làm tròn xuống bội số 900 (15 phút)
const slug = `btc-updown-15m-${currentStart}`;
```

**Giải thích:**
- Mỗi market kéo dài 900 giây (15 phút)
- Timestamp bắt đầu luôn là bội số của 900
- Ví dụ: 1735689600, 1735690500, 1735691400, ...

### 8. Error Handling & Recovery

#### 8.1. WebSocket Connection Errors

```
Connection Lost
    │
    ├─> Log warning: "WebSocket connection closed"
    ├─> Set isConnected = false
    ├─> Stop ping loop
    └─> TODO: Auto-reconnect (chưa implement)
```

#### 8.2. Database Insert Errors

```
Batch Insert Failed
    │
    ├─> Log error với message count
    ├─> Kiểm tra queue size:
    │   ├─> Nếu < 10000 → Đưa messages lại vào queue (retry)
    │   └─> Nếu >= 10000 → Drop messages và log error (tránh memory overflow)
    └─> Continue với batch tiếp theo
```

#### 8.3. Market Not Found

```
Market Fetch Failed
    │
    ├─> Current Market Not Found:
    │   └─> Try previous cycle (currentStart - 900)
    │
    ├─> Upcoming Market Not Found:
    │   └─> Log warning và retry sau (trong monitor loop)
    │
    └─> Continue với market hiện có (không crash)
```

### 9. Shutdown & Cleanup

Khi nhận tín hiệu SIGINT/SIGTERM:

```
Graceful Shutdown
    │
    ├─> Stop MarketManager
    │   ├─> Clear monitorInterval
    │   └─> Clear overlapTimeout
    │
    ├─> Disconnect WebSocket
    │   ├─> Stop ping loop
    │   ├─> Close WebSocket connection
    │   └─> Clear assetToMarketMap và subscribedAssets
    │
    └─> Flush Message Queue
        ├─> Process tất cả messages còn lại trong queue
        ├─> Insert vào database
        └─> Close database connection pool
```

**Quan trọng:** Flush queue đảm bảo không mất dữ liệu khi shutdown

### 10. Utility Scripts

Hệ thống có các script hỗ trợ để kiểm tra và fix dữ liệu:

#### 10.1. `check-messages.js`
- Kiểm tra messages cụ thể (theo ID)
- Thống kê các loại event
- Phân tích NULL values

#### 10.2. `fix-null-messages.js`
- Fix messages có NULL market_slug hoặc asset_id
- Extract từ raw_data và tra cứu trong market_registry
- Update lại các trường bị thiếu

#### 10.3. `check-database.js`
- Kiểm tra tổng quan database
- Thống kê markets và messages
- Hiển thị sample data

#### 10.4. `check-assets.js`
- Verify assets với Polymarket API
- Kiểm tra market status

#### 10.5. `show-raw-messages.js`
- Hiển thị latest raw messages
- Useful để debug

## Các Hằng Số Quan Trọng

```javascript
// Market timing
MARKET_DURATION = 900 seconds (15 phút)
OVERLAP_TIME = 30 seconds (trước khi market kết thúc)
MONITOR_INTERVAL = 5000 ms (5 giây - check market end)

// Database batch
BATCH_SIZE = 100 messages
BATCH_INTERVAL = 1000 ms (1 giây)

// WebSocket
PING_INTERVAL = 10000 ms (10 giây)
MAX_QUEUE_SIZE = 10000 messages (giới hạn để tránh overflow)
```

## Lưu Ý Kỹ Thuật

1. **Non-blocking Design:**
   - Message handling không block WebSocket
   - Batch insert chạy async
   - Market promotion không ảnh hưởng message processing

2. **Connection Pooling:**
   - PostgreSQL pool với max 50 connections
   - Timeout: 30s cho statement, 10s cho connection

3. **Memory Management:**
   - Queue có giới hạn 10000 messages
   - Tránh memory overflow khi database chậm

4. **Idempotency:**
   - Market registry sử dụng ON CONFLICT để tránh duplicate
   - Messages có thể bị duplicate nếu retry (nhưng có received_at để phân biệt)

5. **Timestamp Handling:**
   - Tất cả timestamps lưu trong database là PostgreSQL TIMESTAMP (UTC)
   - Market timestamps lưu dưới dạng BIGINT (Unix seconds)

## Tóm Tắt Logic Chính

1. **Startup:** Khởi tạo DB → Connect WS → Fetch markets → Subscribe → Monitor
2. **Message Flow:** WS message → Parse → Map asset → Queue → Batch insert
3. **Market Lifecycle:** Current + Upcoming → Overlap (30s) → Promote → Repeat
4. **Shutdown:** Stop monitors → Disconnect WS → Flush queue → Close DB

Hệ thống được thiết kế để chạy liên tục và tự động xử lý tất cả các trường hợp chuyển đổi markets mà không cần can thiệp thủ công.

