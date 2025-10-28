-- Setup API Keys in admin_configs table
-- This script creates the api_keys configuration and adds sample keys

-- Step 1: Create api_keys config if not exists
INSERT INTO admin_configs (id, key, data, created_at, updated_at)
VALUES (gen_random_uuid(), 'api_keys', '[]'::jsonb, NOW(), NOW())
ON CONFLICT (key) DO NOTHING;

-- Step 2: Add your API keys
-- Replace 'YOUR_KEY_HERE' with keys generated from: pnpm run generate-api-key

-- Example: Add first API key
UPDATE admin_configs
SET data = jsonb_set(
  COALESCE(data, '[]'::jsonb),
  '{0}',
  jsonb_build_object(
    'key', 'wsk_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    'name', 'Main API Key',
    'active', true,
    'created_at', NOW()
  ),
  true
),
updated_at = NOW()
WHERE key = 'api_keys';

-- Example: Add second API key
UPDATE admin_configs
SET data = data || jsonb_build_array(
  jsonb_build_object(
    'key', 'wsk_fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210',
    'name', 'Backup API Key',
    'active', true,
    'created_at', NOW()
  )
),
updated_at = NOW()
WHERE key = 'api_keys';

-- Verify the keys
SELECT key, data FROM admin_configs WHERE key = 'api_keys';

-- Expected result:
-- key: 'api_keys'
-- data: [
--   {
--     "key": "wsk_...",
--     "name": "Main API Key",
--     "active": true,
--     "created_at": "2025-10-28T..."
--   },
--   {
--     "key": "wsk_...",
--     "name": "Backup API Key",
--     "active": true,
--     "created_at": "2025-10-28T..."
--   }
-- ]

