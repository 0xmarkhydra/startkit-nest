# wallets_server

Dịch vụ **tách riêng** để quản lý ví EVM (Ethereum và các chain tương thích), đảm bảo **lưu trữ private key an toàn** và cung cấp **API nội bộ** cho hệ thống chính.  
Các API chính gồm:
- **Tạo ví mới** cho user.
- **Kiểm tra số dư ví** (ETH + ERC20 token).

> ⚠️ Đây là service nội bộ (internal microservice). Không bao giờ trả về private key qua API.  
> Chỉ hệ thống Backend (NestJS) được phép truy cập qua xác thực JWT nội bộ.

---

## 🚀 Tính năng

- Tạo ví EVM (EOA) theo chuẩn `secp256k1` dùng thư viện `ethers`.
- Private key được **mã hoá bằng AES-256-GCM** với `MASTER_KEY`.
- Hỗ trợ nhiều network: Ethereum, Base, Arbitrum, Optimism…
- Truy vấn số dư ETH và token ERC-20 từ RPC.
- Bảo mật với JWT, IP allowlist, rate limit.
- Audit log cho mọi hành động nhạy cảm.

## 🧩 API Reference

### 🔸 POST `/v1/wallets` – Tạo ví mới

**Request**
```json
{
  "user_id": "user_123456"
}
```

**Response**
```json
{
  "wallet_id": "d1fb2a2c-7f40-4d1b-8a8e-76a9d0176c33",
  "user_id": "user_123456",
  "chain_id": 8453,
  "address": "0xAbCDef1234567890aBCdEF1234567890abCDef12",
  "created_at": "2025-10-27T08:00:00Z"
}
```

**Ghi chú**
- Nếu ví đã tồn tại, trả 200 cùng địa chỉ hiện có.
- Private key không bao giờ được trả ra.

---

### 🔸 GET `/v1/wallets/balance`

Tham số: `user_id` hoặc `address`  
Ví dụ:  
`/v1/wallets/balance?user_id=user_123456`  
hoặc  
`/v1/wallets/balance?address=0x1234...`

**Response**
```json
{
  "address": "0xAbCDef1234567890aBCdEF1234567890abCDef12",
  "chain_id": 8453,
  "native": {
    "symbol": "ETH",
    "decimals": 18,
    "wei": "123450000000000000",
    "human": "0.12345"
  },
  "tokens": [
    {
      "symbol": "USDC",
      "address": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      "decimals": 6,
      "raw": "25000000",
      "human": "25.000000"
    }
  ],
  "as_of": "2025-10-27T08:01:30Z"
}
```

---

## 🧱 Lược đồ cơ sở dữ liệu (Prisma)

```prisma
model UserWallet {
  id             String   @id @default(uuid())
  userId         String   @unique
  chainId        Int
  address        String   @unique
  encPrivKey     Bytes
  encMeta        Bytes?
  custodian      String   // aes_gcm
  createdAt      DateTime @default(now())
}

model AuditLog {
  id        String   @id @default(uuid())
  action    String
  userId    String?
  address   String?
  metadata  Json?
  createdAt DateTime @default(now())
}
```

---

## 🚀 Quick Start

**Muốn chạy ngay?** → Xem `QUICK_START.md`

## 🧰 Chạy dự án

### Yêu cầu

- Node.js >= 18
- PostgreSQL >= 13
- Redis >= 6
- pnpm

### Cài đặt & Cấu hình

```bash
# 1. Cài đặt phụ thuộc
pnpm install

# 2. Tạo file .env từ mẫu
cp env.example.txt .env

# 3. Cấu hình các biến quan trọng trong .env
# MASTER_KEY: Khóa mã hóa private key (bắt buộc)
# IP_WHITELIST: Danh sách IP được phép truy cập (bắt buộc)
nano .env

# 4. Start server
pnpm start:dev  # Development
# hoặc
pnpm build && pnpm start:prod  # Production
```

### Cấu hình Environment Variables

**Bắt buộc:**

```bash
# Mã hóa private keys
MASTER_KEY=your-super-secret-master-key-change-this

# IP whitelist (comma-separated)
IP_WHITELIST=127.0.0.1,192.168.1.100

# JWT secret
JWT_SECRET_KEY=your-jwt-secret
```

### Cấu hình API Keys

**Development (Tự động):**
- Khi chạy lần đầu, 1 API key mặc định sẽ được tự động tạo
- Key: `wsk_dev_1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcd`
- Dùng ngay không cần setup thêm

**Production (Generate key mới):**

```bash
# 1. Generate API keys
cd scripts
pnpm install
pnpm run generate-api-key

# 2. Setup keys trong database
psql -U postgres -d wallet_server -f setup-api-keys.sql
# Hoặc làm theo hướng dẫn trong API_KEY_SETUP.md
```

**Chi tiết:** 
- Bảo mật: `WALLET_SETUP.md`
- API Keys: `API_KEY_SETUP.md`

### Docker

```bash
docker build -t wallets_server:latest .
docker run --env-file .env -p 8080:8080 wallets_server:latest
```

---

## 🔒 Bảo mật

- Private key **chỉ lưu dạng mã hoá** trong DB bằng AES-256-GCM với `MASTER_KEY`.  
- Không log hoặc expose private key.  
- **API Key Authentication**: Yêu cầu API key hợp lệ (lưu trong database) cho mọi request.
- **IP Whitelist**: Chỉ cho phép các IP được cấu hình trong `IP_WHITELIST` truy cập API.
- Rate limiting cho tất cả endpoints.
- Audit log chi tiết cho mọi thao tác nhạy cảm (tạo ví, lấy private key).

---

## 🩺 Healthcheck & Observability

| Endpoint | Mô tả |
|-----------|--------|
| `/healthz` | Kiểm tra tình trạng server (HTTP 200 nếu OK). |
| `/metrics` | (Tùy chọn) Prometheus metrics: latency, RPC, error count. |

---

## 🧠 Ví dụ sử dụng cURL

```bash
export API_KEY="wsk_your_generated_api_key_here"

# Tạo ví
curl -X POST http://localhost:3000/v1/wallets \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"user_id":"user_123456"}'

# Lấy private key (admin only)
curl -X GET "http://localhost:3000/v1/wallets/private-key?user_id=user_123456" \
  -H "X-API-Key: $API_KEY"
```

---

## 📦 Deployment gợi ý

- **Database**: PostgreSQL (RDS/Aiven).
- **Key storage**: AES-256-GCM với MASTER_KEY (lưu trong environment variables).
- **RPC provider**: Alchemy, Infura, hoặc self-host.
- **Container**: Docker + Railway / Render / AWS ECS.
- **Monitoring**: Prometheus + Grafana hoặc Sentry.

---

## 🔐 Quy tắc vận hành

- Mỗi `user_id` chỉ có một ví duy nhất trên mỗi `CHAIN_ID`.
- Chạy healthcheck định kỳ 30s.
- Rotation `MASTER_KEY` mỗi 90 ngày (re-encrypt tất cả private keys trong DB).
- Backup DB hàng ngày (không chứa private key plaintext).
- Log mọi request tạo ví hoặc truy vấn balance.

---

## 🧾 License

**© 2025 Pre-TGE Platform**  
Internal Service – Do not expose to end users.  
Không public private key, không sử dụng ngoài phạm vi nội bộ.

---

## 🗺️ Roadmap

- [ ] Hỗ trợ multi-chain (Arbitrum, Optimism, Solana module riêng)
- [ ] Batch balance query
- [ ] Webhook khi số dư thay đổi
- [ ] Key rotation job (re-encrypt AES blob)
- [ ] Attestation proof: “No private key exposure”
