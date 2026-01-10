"""
Script để kiểm tra dữ liệu trong ClickHouse database
"""
import aiohttp
import asyncio
import os
from dotenv import load_dotenv

load_dotenv()

CLICKHOUSE_HOST = os.getenv("CLICKHOUSE_HOST", "localhost")
CLICKHOUSE_PORT = int(os.getenv("CLICKHOUSE_PORT", "8123"))
CLICKHOUSE_USER = os.getenv("CLICKHOUSE_USER", "default")
CLICKHOUSE_PASSWORD = os.getenv("CLICKHOUSE_PASSWORD", "password")
DATABASE = os.getenv("DATABASE", "polymarket_db")

def get_clickhouse_url():
    """Build ClickHouse HTTP URL with auth"""
    return f"http://{CLICKHOUSE_HOST}:{CLICKHOUSE_PORT}?user={CLICKHOUSE_USER}&password={CLICKHOUSE_PASSWORD}"

async def query_clickhouse(query: str):
    """Execute query against ClickHouse"""
    url = get_clickhouse_url()
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(url, data=query) as resp:
                if resp.status == 200:
                    text = await resp.text()
                    return text.strip()
                else:
                    error_text = await resp.text()
                    return f"Error {resp.status}: {error_text[:200]}"
    except aiohttp.ClientConnectorError as e:
        return f"Connection Error: {e}"
    except Exception as e:
        return f"Error: {e}"

async def main():
    print("="*60)
    print(f"ClickHouse Connection Info:")
    print(f"  Host: {CLICKHOUSE_HOST}:{CLICKHOUSE_PORT}")
    print(f"  User: {CLICKHOUSE_USER}")
    print(f"  Database: {DATABASE}")
    print("="*60)
    print()
    
    # Test connection
    print("1. Testing connection...")
    result = await query_clickhouse("SELECT version()")
    if "Connection Error" in result or "Error" in result:
        print(f"   ❌ {result}")
        print("\n   ⚠️  ClickHouse không thể kết nối!")
        print("   Hãy kiểm tra:")
        print("   - ClickHouse có đang chạy không?")
        print("   - Cấu hình trong .env file có đúng không?")
        return
    else:
        print(f"   ✅ Connected: {result}")
    print()
    
    # Check if database exists
    print(f"2. Checking database '{DATABASE}'...")
    result = await query_clickhouse(f"SHOW DATABASES LIKE '{DATABASE}'")
    if result:
        print(f"   ✅ Database exists")
    else:
        print(f"   ⚠️  Database chưa được tạo")
    print()
    
    # List tables
    print(f"3. Listing tables in '{DATABASE}'...")
    result = await query_clickhouse(f"SHOW TABLES FROM {DATABASE}")
    if result and "Error" not in result:
        tables = [t.strip() for t in result.split('\n') if t.strip()]
        if tables:
            print(f"   ✅ Found {len(tables)} table(s):")
            for table in tables:
                print(f"      - {table}")
        else:
            print(f"   ⚠️  No tables found")
    else:
        print(f"   {result}")
    print()
    
    # Count records in each table
    expected_tables = [
        "btc_chainlink_prices",
        "market_orderbooks_analytics",
        "market_price_changes",
        "market_trades"
    ]
    
    print("4. Checking data counts...")
    for table in expected_tables:
        result = await query_clickhouse(f"SELECT count() FROM {DATABASE}.{table}")
        if result and "Error" not in result:
            try:
                count = int(result.strip())
                print(f"   {table:35} = {count:,} records")
            except:
                print(f"   {table:35} = {result}")
        else:
            print(f"   {table:35} = {result}")
    print()
    
    # Show sample data from each table (latest 5 records)
    print("5. Sample data (latest 5 records from each table)...")
    print()
    
    for table in expected_tables:
        print(f"   📊 {table}:")
        result = await query_clickhouse(
            f"SELECT * FROM {DATABASE}.{table} ORDER BY timestamp DESC LIMIT 5 FORMAT PrettyCompact"
        )
        if result and "Error" not in result and result.strip():
            lines = result.strip().split('\n')
            for line in lines[:10]:  # Show first 10 lines
                print(f"      {line}")
        else:
            print(f"      (no data or error: {result[:100]})")
        print()

if __name__ == "__main__":
    asyncio.run(main())

