# 🚀 Quick Start Guide

Hướng dẫn chạy Wallet Server trong 5 phút!

---

## 📋 Yêu cầu

- Node.js >= 18
- PostgreSQL >= 13
- Redis >= 6
- pnpm

---

## ⚡ Bắt đầu nhanh

### 1. Clone & Install

```bash
cd /path/to/wallet_server
pnpm install
```

### 2. Setup Database

```bash
# Start PostgreSQL (Docker)
docker run -d \
  --name wallet_postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=wallet_server \
  -p 5432:5432 \
  postgres:15

# Start Redis (Docker)
docker run -d \
  --name wallet_redis \
  -p 6379:6379 \
  redis:7-alpine
```

### 3. Configure Environment

```bash
# Copy template
cp env.example.txt .env

# Edit .env (tối thiểu)
nano .env
```

**Cấu hình tối thiểu:**

```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=wallet_server
DB_SYNC=1  # Tự động tạo tables

# Security
MASTER_KEY=my-development-master-key-change-in-production
IP_WHITELIST=127.0.0.1,::1

# API Key (optional - để trống sẽ dùng default key)
DEFAULT_API_KEY=

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# App
IS_API=1
PORT=3000
```

### 4. Run Server

```bash
pnpm start:dev
```

**Khi server start thành công, bạn sẽ thấy:**

```
🌱 [SeedDatabase] Starting database seeding...
🔑 [SeedDatabase] Checking API keys...
✅ [SeedDatabase] Created new API keys config with default key

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔑 DEFAULT API KEY (For Development/Testing Only)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   wsk_dev_1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcd
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚀 Application is running in port http://localhost:3000
```

---

## 🧪 Test API

### Bước 1: Set API Key

```bash
export API_KEY="wsk_dev_1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcd"
```

### Bước 2: Tạo Ví

```bash
curl -X POST http://localhost:3000/v1/wallets \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"user_id":"user_123456"}'
```

**Expected Response:**

```json
{
  "statusCode": 200,
  "message": "Wallet retrieved successfully",
  "data": {
    "wallet_id": "d1fb2a2c-7f40-4d1b-8a8e-76a9d0176c33",
    "user_id": "user_123456",
    "chain_id": 8453,
    "address": "0xAbCDef1234567890aBCdEF1234567890abCDef12",
    "created_at": "2025-10-28T08:00:00Z"
  }
}
```

### Bước 3: Lấy Private Key (Admin)

```bash
curl -X GET "http://localhost:3000/v1/wallets/private-key?user_id=user_123456" \
  -H "X-API-Key: $API_KEY"
```

**Expected Response:**

```json
{
  "statusCode": 200,
  "message": "Private key retrieved successfully",
  "data": {
    "address": "0xAbCDef1234567890aBCdEF1234567890abCDef12",
    "private_key": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
  }
}
```

---

## 📚 Swagger UI

Mở trình duyệt:

```
http://localhost:3000/docs
```

**Authorize với API Key:**
1. Click nút **"Authorize"** (🔒 icon)
2. Nhập API key: `wsk_dev_1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcd`
3. Click **"Authorize"**
4. Test các API trực tiếp trên UI

---

## 🔍 Verify Database

```bash
# Connect to PostgreSQL
psql -U postgres -d wallet_server

# Check tables
\dt

# Check API keys
SELECT key, data FROM admin_configs WHERE key = 'api_keys';

# Check wallets
SELECT id, user_id, chain_id, address, created_at FROM user_wallets;

# Check audit logs
SELECT action, user_id, address, created_at FROM audit_logs ORDER BY created_at DESC LIMIT 10;
```

---

## 🎯 Cheat Sheet

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `IS_API` | 0 | Set to 1 to run API server |
| `PORT` | 3000 | Server port |
| `DB_SYNC` | 0 | Set to 1 to auto-create tables |
| `MASTER_KEY` | - | **REQUIRED** - Private key encryption key |
| `IP_WHITELIST` | - | Comma-separated allowed IPs |

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| POST | `/v1/wallets` | Create wallet |
| GET | `/v1/wallets/private-key` | Get private key |
| GET | `/docs` | Swagger UI |

### Default API Key

```
wsk_dev_1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcd
```

---

## ⚠️ Common Issues

### Issue: Cannot connect to database

**Solution:**
```bash
# Check PostgreSQL is running
docker ps | grep postgres

# Check connection
psql -U postgres -h localhost -p 5432 -d wallet_server
```

### Issue: "MASTER_KEY is not configured"

**Solution:**
Add to `.env`:
```bash
MASTER_KEY=your-secret-key-here
```

### Issue: "IP not whitelisted"

**Solution 1** - Disable whitelist for development:
```bash
IP_WHITELIST=*
```

**Solution 2** - Add your IP:
```bash
# Get your IP
curl ifconfig.me

# Add to .env
IP_WHITELIST=127.0.0.1,your-ip-here
```

### Issue: "API key is required"

**Solution:**
Add header to request:
```bash
-H "X-API-Key: wsk_dev_1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcd"
```

---

## 📖 Next Steps

- **Production Setup**: Read `WALLET_SETUP.md`
- **API Keys Management**: Read `API_KEY_SETUP.md`
- **Generate Secure Keys**: `cd scripts && pnpm run generate-api-key`
- **Advanced Config**: See `README.md`

---

## 🆘 Need Help?

- Check logs: Server console output
- Check database: `psql` commands above
- Review audit logs: `SELECT * FROM audit_logs`
- Read full docs: `README.md`, `WALLET_SETUP.md`, `API_KEY_SETUP.md`

---

**🎉 Chúc mừng! Bạn đã setup thành công Wallet Server!**

