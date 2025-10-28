# Wallet Server - Setup Guide

## 🔐 Security Configuration

### 1. MASTER_KEY Setup

Private keys are encrypted using AES-256-GCM with a MASTER_KEY.

**Generate a strong MASTER_KEY:**

```bash
# Option 1: Use a strong passphrase
MASTER_KEY="my-very-long-and-secure-master-key-that-nobody-can-guess-2024"

# Option 2: Generate random string (recommended)
# On Linux/Mac:
openssl rand -base64 32

# Result example:
# MASTER_KEY="K7gNU3sdo+OL0wNhqoVWhr3g6s1xYv72ol/pe/Unols="
```

⚠️ **IMPORTANT:**
- Keep this key ABSOLUTELY SECRET
- Never commit it to version control
- If leaked, ALL private keys can be decrypted
- Back up this key securely (encrypted backup)

---

### 2. IP Whitelist Setup

Only whitelisted IPs can access wallet APIs for maximum security.

**Configure IP_WHITELIST in .env:**

```bash
# Development (allow localhost only)
IP_WHITELIST=127.0.0.1,::1

# Production (specific IPs only)
IP_WHITELIST=203.0.113.10,203.0.113.11,10.0.1.50

# Behind proxy/load balancer (use X-Forwarded-For)
IP_WHITELIST=203.0.113.10

# Disable whitelist (NOT RECOMMENDED)
IP_WHITELIST=*
```

**How to find your server IP:**

```bash
# On your server
curl ifconfig.me

# Or
curl icanhazip.com
```

**For internal network:**
```bash
# Linux/Mac
ip addr show
ifconfig

# Result: Add the IP to whitelist
IP_WHITELIST=192.168.1.100
```

---

### 3. Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

**Edit .env file:**

```bash
# Security (REQUIRED)
MASTER_KEY=your-super-secret-master-key-here
IP_WHITELIST=127.0.0.1,your-server-ip

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your-db-password
DB_DATABASE=wallet_server
DB_SYNC=1  # Auto-create tables (development only)

# JWT
JWT_SECRET_KEY=your-jwt-secret
```

---

## 🚀 Quick Start

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Setup Database

```bash
# Start PostgreSQL (Docker example)
docker run -d \
  --name wallet_postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=wallet_server \
  -p 5432:5432 \
  postgres:15

# Or use your existing PostgreSQL instance
```

### 3. Setup Redis

```bash
# Start Redis (Docker example)
docker run -d \
  --name wallet_redis \
  -p 6379:6379 \
  redis:7-alpine

# Or use your existing Redis instance
```

### 4. Configure .env

```bash
# Copy and edit
cp .env.example .env
nano .env  # or vim, code, etc.
```

### 5. Run Server

```bash
# Development mode
pnpm start:dev

# Production mode
pnpm build
pnpm start:prod
```

Server will start on `http://localhost:3000` (or your configured PORT)

---

## 🧪 Testing APIs

### Access Swagger UI

```
http://localhost:3000/docs
```

### Test Create Wallet

```bash
export TOKEN="your-jwt-token"

curl -X POST http://localhost:3000/v1/wallets \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"user_id":"550e8400-e29b-41d4-a716-446655440000"}'
```

**Expected Response:**
```json
{
  "statusCode": 200,
  "message": "Wallet retrieved successfully",
  "data": {
    "wallet_id": "d1fb2a2c-7f40-4d1b-8a8e-76a9d0176c33",
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "chain_id": 8453,
    "address": "0xAbCDef1234567890aBCdEF1234567890abCDef12",
    "created_at": "2025-10-27T08:00:00Z"
  }
}
```

### Test Get Private Key (Admin only)

```bash
curl -X GET "http://localhost:3000/v1/wallets/private-key?user_id=550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer $TOKEN"
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

## 🔒 Security Best Practices

### Production Checklist

- [ ] Set strong `MASTER_KEY` (32+ characters)
- [ ] Configure `IP_WHITELIST` with specific IPs only
- [ ] Use strong `JWT_SECRET_KEY`
- [ ] Set `DB_SYNC=0` (use migrations instead)
- [ ] Enable SSL/TLS for database connection
- [ ] Use environment-specific `.env` files
- [ ] Never log `MASTER_KEY` or private keys
- [ ] Regularly review audit logs
- [ ] Backup database encrypted
- [ ] Monitor failed IP whitelist attempts
- [ ] Rotate `MASTER_KEY` every 90 days (requires re-encryption)

### IP Whitelist Scenarios

**1. Single server application:**
```bash
IP_WHITELIST=127.0.0.1
```

**2. Multiple backend servers:**
```bash
IP_WHITELIST=10.0.1.10,10.0.1.11,10.0.1.12
```

**3. Behind load balancer/proxy:**
```bash
# Whitelist the proxy IP
IP_WHITELIST=10.0.0.1

# The Guard will read X-Forwarded-For header
```

**4. Development mode:**
```bash
IP_WHITELIST=*
```

---

## 📊 Monitoring

### Check Audit Logs

All sensitive operations are logged in `audit_logs` table:

```sql
SELECT * FROM audit_logs 
WHERE action IN ('CREATE_WALLET', 'GET_PRIVATE_KEY')
ORDER BY created_at DESC 
LIMIT 100;
```

### Monitor Failed IP Attempts

Check server logs for:
```
🔴 [IpWhitelistGuard] IP 203.0.113.50 is not in whitelist
```

---

## 🆘 Troubleshooting

### Issue: "IP not whitelisted" error

**Solution:**
1. Check your current IP:
   ```bash
   curl ifconfig.me
   ```
2. Add it to `.env`:
   ```bash
   IP_WHITELIST=127.0.0.1,your-ip-here
   ```
3. Restart server

### Issue: "MASTER_KEY is not configured"

**Solution:**
Add to `.env`:
```bash
MASTER_KEY=your-secret-key-here
```

### Issue: Cannot decrypt private key

**Possible causes:**
- MASTER_KEY changed after encryption
- Database corruption
- Wrong custodian type

**Solution:**
- Ensure MASTER_KEY matches the one used during encryption
- Check `custodian` field in database (should be 'aes_gcm')

---

## 🔄 Key Rotation (Advanced)

When you need to rotate MASTER_KEY:

1. **Create new MASTER_KEY:**
   ```bash
   NEW_MASTER_KEY=$(openssl rand -base64 32)
   ```

2. **Re-encrypt all private keys:**
   ```typescript
   // TODO: Implement key rotation script
   // This requires:
   // 1. Decrypt all keys with old MASTER_KEY
   // 2. Encrypt with new MASTER_KEY
   // 3. Update database
   ```

3. **Update .env with new key**

4. **Backup old key** (in case of rollback)

---

## 📞 Support

For security issues, contact: security@your-company.com

**NEVER share:**
- MASTER_KEY
- Private keys
- JWT secrets
- Database credentials

