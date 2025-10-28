import * as crypto from 'crypto';

/**
 * Generate a secure API key
 * Format: prefix_randomBytes
 */
function generateApiKey(prefix = 'wsk'): string {
  // Generate 32 random bytes and convert to hex (64 characters)
  const randomBytes = crypto.randomBytes(32).toString('hex');
  
  // Combine prefix with random bytes
  return `${prefix}_${randomBytes}`;
}

/**
 * Generate multiple API keys
 */
function generateMultipleKeys(count: number, prefix = 'wsk'): void {
  console.log(`\n🔑 Generating ${count} API key(s)...\n`);
  
  for (let i = 1; i <= count; i++) {
    const key = generateApiKey(prefix);
    console.log(`Key ${i}: ${key}`);
  }
  
  console.log('\n📝 Instructions:');
  console.log('1. Copy one or more keys above');
  console.log('2. Insert them into database using SQL:');
  console.log('\n```sql');
  console.log(`INSERT INTO admin_configs (id, key, data, created_at, updated_at)`);
  console.log(`VALUES (gen_random_uuid(), 'api_keys', '[]', NOW(), NOW());`);
  console.log('```');
  console.log('\n3. Then update the api_keys data with:');
  console.log('\n```sql');
  console.log(`UPDATE admin_configs`);
  console.log(`SET data = jsonb_set(`);
  console.log(`  COALESCE(data, '[]'::jsonb),`);
  console.log(`  '{0}',`);
  console.log(`  '{"key": "YOUR_KEY_HERE", "name": "Main API Key", "active": true, "created_at": "2025-10-28T00:00:00Z"}'::jsonb,`);
  console.log(`  true`);
  console.log(`)`);
  console.log(`WHERE key = 'api_keys';`);
  console.log('```');
  console.log('\n⚠️  Keep these keys SECRET! They provide full access to the wallet API.\n');
}

// Get arguments from command line
const args = process.argv.slice(2);
const count = args[0] ? parseInt(args[0]) : 1;
const prefix = args[1] || 'wsk';

// Generate keys
generateMultipleKeys(count, prefix);

