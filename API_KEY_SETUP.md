# API Key Authentication Setup

## 📋 Overview

Wallet Server uses **API Key authentication** stored in the `admin_configs` table for maximum security and simplicity.

---

## 🎯 Quick Start (Development)

### Default API Key

Khi chạy server lần đầu, một API key mặc định sẽ được tự động tạo.

**Cách 1: Sử dụng custom key (Khuyến nghị)**

Thêm vào `.env`:
```bash
DEFAULT_API_KEY=your-custom-key-here
```

**Cách 2: Sử dụng hardcoded key (Development only)**

Nếu không set `DEFAULT_API_KEY` trong `.env`, sẽ dùng key mặc định:
```
wsk_dev_1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcd
```

**Sử dụng ngay:**

```bash
export API_KEY="wsk_dev_1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcd"

curl -X POST http://localhost:3000/v1/wallets \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"user_id":"550e8400-e29b-41d4-a716-446655440000"}'
```

⚠️ **WARNING**: Chỉ dùng cho development! Không dùng trong production!

---

## 🔑 Generate API Keys (Production)

### Step 1: Generate Keys

```bash
cd scripts
pnpm install  # If not installed yet

# Generate 1 API key
pnpm run generate-api-key

# Generate multiple keys
pnpm run generate-api-key 3

# Generate with custom prefix
pnpm run generate-api-key 2 myapp
```

**Example output:**
```
🔑 Generating 2 API key(s)...

Key 1: wsk_a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890
Key 2: wsk_f9e8d7c6b5a43210f9e8d7c6b5a43210f9e8d7c6b5a43210f9e8d7c6b5a43210
```

⚠️ **Keep these keys SECRET!**

---

## 💾 Store API Keys in Database

### Method 1: Using SQL Script (Recommended)

```bash
# 1. Edit scripts/setup-api-keys.sql
# 2. Replace placeholder keys with your generated keys
# 3. Run the SQL script

psql -U postgres -d wallet_server -f scripts/setup-api-keys.sql
```

### Method 2: Manual SQL Commands

```sql
-- Step 1: Create api_keys config (only once)
INSERT INTO admin_configs (id, key, data, created_at, updated_at)
VALUES (gen_random_uuid(), 'api_keys', '[]'::jsonb, NOW(), NOW())
ON CONFLICT (key) DO NOTHING;

-- Step 2: Add your first API key
UPDATE admin_configs
SET data = jsonb_build_array(
  jsonb_build_object(
    'key', 'wsk_YOUR_GENERATED_KEY_HERE',
    'name', 'Main API Key',
    'active', true,
    'created_at', NOW()
  )
),
updated_at = NOW()
WHERE key = 'api_keys';

-- Step 3: Add additional keys (optional)
UPDATE admin_configs
SET data = data || jsonb_build_array(
  jsonb_build_object(
    'key', 'wsk_ANOTHER_GENERATED_KEY_HERE',
    'name', 'Backup API Key',
    'active', true,
    'created_at', NOW()
  )
),
updated_at = NOW()
WHERE key = 'api_keys';

-- Verify
SELECT key, data FROM admin_configs WHERE key = 'api_keys';
```

---

## 🧪 Test API with Key

### Using cURL

```bash
# Set your API key
export API_KEY="wsk_a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890"

# Test create wallet
curl -X POST http://localhost:3000/v1/wallets \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"user_id":"user_123456"}'

# Test get private key
curl -X GET "http://localhost:3000/v1/wallets/private-key?user_id=user_123456" \
  -H "X-API-Key: $API_KEY"
```

### Using Swagger UI

1. Open http://localhost:3000/docs
2. Click **"Authorize"** button (lock icon)
3. Enter your API key in the **X-API-Key** field
4. Click **"Authorize"**
5. Test the APIs

### Using Postman/Insomnia

Add header:
```
X-API-Key: wsk_your_api_key_here
```

---

## 🔒 API Key Format

```
Structure: {prefix}_{64_hex_characters}
Example:   wsk_a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890

Prefix: wsk (Wallet Server Key)
Random: 64 hexadecimal characters (256 bits of entropy)
```

---

## 🗄️ Database Structure

API keys are stored in `admin_configs` table:

```json
{
  "key": "api_keys",
  "data": [
    {
      "key": "wsk_...",
      "name": "Main API Key",
      "active": true,
      "created_at": "2025-10-28T10:00:00Z"
    },
    {
      "key": "wsk_...",
      "name": "Backup API Key", 
      "active": true,
      "created_at": "2025-10-28T11:00:00Z"
    }
  ]
}
```

---

## 🛠️ Manage API Keys

### List All Keys

```sql
SELECT 
  jsonb_array_elements(data) as api_key
FROM admin_configs 
WHERE key = 'api_keys';
```

### Deactivate a Key

```sql
UPDATE admin_configs
SET data = (
  SELECT jsonb_agg(
    CASE 
      WHEN elem->>'key' = 'wsk_KEY_TO_DEACTIVATE'
      THEN jsonb_set(elem, '{active}', 'false')
      ELSE elem
    END
  )
  FROM jsonb_array_elements(data) elem
),
updated_at = NOW()
WHERE key = 'api_keys';
```

### Remove a Key

```sql
UPDATE admin_configs
SET data = (
  SELECT jsonb_agg(elem)
  FROM jsonb_array_elements(data) elem
  WHERE elem->>'key' != 'wsk_KEY_TO_REMOVE'
),
updated_at = NOW()
WHERE key = 'api_keys';
```

### Add a New Key

```sql
UPDATE admin_configs
SET data = data || jsonb_build_array(
  jsonb_build_object(
    'key', 'wsk_NEW_GENERATED_KEY_HERE',
    'name', 'New API Key Name',
    'active', true,
    'created_at', NOW()
  )
),
updated_at = NOW()
WHERE key = 'api_keys';
```

---

## 🔐 Security Best Practices

### ✅ DO

- Generate keys with high entropy (use the provided script)
- Store keys securely (never commit to git)
- Use different keys for different environments (dev/staging/prod)
- Rotate keys periodically (every 90 days)
- Keep a backup key in case primary key is compromised
- Log all API key usage via audit logs
- Deactivate compromised keys immediately

### ❌ DON'T

- Share API keys via insecure channels (email, Slack, etc.)
- Hardcode API keys in source code
- Use the same key across multiple applications
- Log API keys in plaintext
- Store keys in version control
- Use weak or predictable keys

---

## 🚨 If API Key is Compromised

1. **Immediate action:**
   ```sql
   -- Deactivate the compromised key
   UPDATE admin_configs
   SET data = (
     SELECT jsonb_agg(
       CASE 
         WHEN elem->>'key' = 'wsk_COMPROMISED_KEY'
         THEN jsonb_set(elem, '{active}', 'false')
         ELSE elem
       END
     )
     FROM jsonb_array_elements(data) elem
   ),
   updated_at = NOW()
   WHERE key = 'api_keys';
   ```

2. **Generate and activate new key:**
   ```bash
   cd scripts
   pnpm run generate-api-key
   # Add to database using SQL
   ```

3. **Review audit logs:**
   ```sql
   SELECT * FROM audit_logs
   WHERE created_at > NOW() - INTERVAL '7 days'
   ORDER BY created_at DESC;
   ```

4. **Update all clients** with the new API key

---

## 🧪 Troubleshooting

### Error: "API key is required"

**Cause:** Missing X-API-Key header

**Solution:**
```bash
# Add header to your request
curl -H "X-API-Key: your-key-here" ...
```

### Error: "Invalid or inactive API key"

**Causes:**
1. Wrong API key
2. Key is deactivated
3. Key not in database

**Solutions:**
1. Verify key in database:
   ```sql
   SELECT data FROM admin_configs WHERE key = 'api_keys';
   ```
2. Check if key is active:
   ```sql
   SELECT 
     elem->>'name' as name,
     elem->>'key' as key,
     elem->>'active' as active
   FROM admin_configs,
   jsonb_array_elements(data) elem
   WHERE key = 'api_keys';
   ```

### Error: "API key authentication is not configured"

**Cause:** No api_keys in database

**Solution:**
```sql
INSERT INTO admin_configs (id, key, data, created_at, updated_at)
VALUES (gen_random_uuid(), 'api_keys', '[]'::jsonb, NOW(), NOW());
```

---

## 📊 Monitoring

### Track API Key Usage

Check server logs for:
```
✅ [ApiKeyGuard] Valid API key: Main API Key
```

### Monitor Failed Attempts

```
🔴 [ApiKeyGuard] Invalid or inactive API key
```

### Audit Logs

All wallet operations are logged with API key info:
```sql
SELECT * FROM audit_logs 
WHERE metadata->>'requested_by' IS NOT NULL
ORDER BY created_at DESC
LIMIT 100;
```

---

## 🔄 Key Rotation Schedule

Recommended rotation schedule:
- **Production keys:** Every 90 days
- **Staging keys:** Every 180 days
- **Development keys:** Annually

**Rotation Process:**
1. Generate new key
2. Add to database (keep old key active)
3. Update clients with new key
4. Verify clients are using new key
5. Deactivate old key
6. Monitor for issues
7. Remove old key after 30 days

---

## 📞 Support

For security issues related to API keys:
- **DO NOT** share keys in support tickets
- Contact: security@your-company.com
- Use secure channel for key exchange

