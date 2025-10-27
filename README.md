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
  "user_id": "2d9b2c46-2a9e-4d1b-8bdf-8b7f9d7a0ef1"
}
```

**Response**
```json
{
  "wallet_id": "d1fb2a2c-7f40-4d1b-8a8e-76a9d0176c33",
  "user_id": "2d9b2c46-2a9e-4d1b-8bdf-8b7f9d7a0ef1",
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
`/v1/wallets/balance?user_id=xxxxx`  
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

## 🧰 Chạy dự án

```bash
# 1. Cài đặt phụ thuộc
pnpm install

# 2. Chạy migration
pnpm prisma migrate deploy

# 3. Start server
pnpm start
# hoặc chế độ dev
pnpm dev
```

### Docker

```bash
docker build -t wallets_server:latest .
docker run --env-file .env -p 8080:8080 wallets_server:latest
```

---

## 🔒 Bảo mật

- Private key **chỉ lưu dạng mã hoá** trong DB bằng AES-256-GCM.  
- Không log hoặc expose private key.  
- Chỉ chấp nhận request từ Backend có JWT hợp lệ.  
- Hỗ trợ whitelist IP & giới hạn tốc độ request.  
- Audit log cho tất cả thao tác tạo ví & truy vấn số dư.

---

## 🩺 Healthcheck & Observability

| Endpoint | Mô tả |
|-----------|--------|
| `/healthz` | Kiểm tra tình trạng server (HTTP 200 nếu OK). |
| `/metrics` | (Tùy chọn) Prometheus metrics: latency, RPC, error count. |

---

## 🧠 Ví dụ sử dụng cURL

```bash
export TOKEN="eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."

# Tạo ví
curl -X POST http://localhost:8080/v1/wallets   -H "Authorization: Bearer $TOKEN"   -H "Content-Type: application/json"   -d '{"user_id":"2d9b2c46-2a9e-4d1b-8bdf-8b7f9d7a0ef1"}'

# Kiểm tra số dư
curl "http://localhost:8080/v1/wallets/balance?user_id=2d9b2c46-2a9e-4d1b-8bdf-8b7f9d7a0ef1"   -H "Authorization: Bearer $TOKEN"
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
