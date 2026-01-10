-- Query to compare records 221 and 222
-- Run this in your PostgreSQL database

SELECT 
    id,
    event_type,
    market_slug,
    asset_id,
    market_status,
    jsonb_pretty(raw_data) as raw_data_formatted,
    received_at,
    created_at
FROM ws_raw_messages
WHERE id IN ('221', '222')
ORDER BY id;

-- Detailed comparison
SELECT 
    id,
    event_type,
    market_slug,
    asset_id,
    market_status,
    raw_data->>'asset_id' as raw_data_asset_id,
    raw_data->>'price' as raw_data_price,
    raw_data->>'event_type' as raw_data_event_type,
    raw_data ? 'price_changes' as has_price_changes,
    raw_data ? 'bids' as has_bids,
    raw_data ? 'asks' as has_asks,
    jsonb_object_keys(raw_data) as raw_data_keys
FROM ws_raw_messages
WHERE id IN ('221', '222')
ORDER BY id;

