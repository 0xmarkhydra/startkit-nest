-- Script để kiểm tra và sửa index_15m trùng lặp trong market_registry
-- Chạy script này để:
-- 1. Kiểm tra các markets có index_15m trùng lặp (cùng ngày)
-- 2. Recalculate index_15m từ start_timestamp
-- 3. Xác định markets ended trùng lặp

-- 1. Kiểm tra tổng số markets theo status
SELECT 
  status,
  COUNT(*) as count
FROM market_registry
GROUP BY status
ORDER BY count DESC;

-- 2. Kiểm tra index_15m trùng lặp (cùng ngày, cùng index)
-- Đây là vấn đề thực sự: không nên có 2 markets cùng index trong 1 ngày
SELECT 
  index_15m,
  DATE(TO_TIMESTAMP(start_timestamp)) as date,
  COUNT(*) as count,
  array_agg(slug ORDER BY created_at) as slugs,
  array_agg(id ORDER BY created_at) as ids,
  array_agg(status ORDER BY created_at) as statuses
FROM market_registry
WHERE index_15m IS NOT NULL
GROUP BY index_15m, DATE(TO_TIMESTAMP(start_timestamp))
HAVING COUNT(*) > 1
ORDER BY date DESC, index_15m ASC;

-- 3. Recalculate index_15m từ start_timestamp để fix
-- Script này sẽ update index_15m dựa trên start_timestamp
-- Lưu ý: Chỉ chạy nếu bạn chắc chắn muốn recalculate tất cả
/*
UPDATE market_registry
SET 
  index_15m = (
    CASE 
      WHEN start_timestamp IS NOT NULL THEN
        -- Calculate index: (seconds from start of day / 900) + 1
        -- 1 day = 24 hours * 60 minutes / 15 minutes = 96 markets
        -- Index starts from 1, not 0
        (
          FLOOR(
            (start_timestamp - EXTRACT(EPOCH FROM DATE_TRUNC('day', TO_TIMESTAMP(start_timestamp)))) / 900
          ) + 1
        )
      ELSE NULL
    END
  )
WHERE start_timestamp IS NOT NULL
  AND (
    -- Only update if index_15m is NULL or if we want to recalculate all
    index_15m IS NULL
    OR index_15m != (
      FLOOR(
        (start_timestamp - EXTRACT(EPOCH FROM DATE_TRUNC('day', TO_TIMESTAMP(start_timestamp)))) / 900
      ) + 1
    )
  );
*/

-- 4. Kiểm tra markets có index_15m = NULL
SELECT 
  id,
  slug,
  status,
  start_timestamp,
  TO_TIMESTAMP(start_timestamp) as start_date,
  index_15m
FROM market_registry
WHERE index_15m IS NULL
ORDER BY start_timestamp DESC
LIMIT 20;

-- 5. Kiểm tra số markets mỗi ngày (nên có 96 markets với index 1-96)
SELECT 
  DATE(TO_TIMESTAMP(start_timestamp)) as date,
  COUNT(*) as total_markets,
  COUNT(DISTINCT index_15m) as unique_indexes,
  MIN(index_15m) as min_index,
  MAX(index_15m) as max_index,
  CASE 
    WHEN COUNT(*) = 96 AND COUNT(DISTINCT index_15m) = 96 THEN 'OK'
    ELSE 'ISSUE'
  END as status
FROM market_registry
WHERE index_15m IS NOT NULL
GROUP BY DATE(TO_TIMESTAMP(start_timestamp))
ORDER BY date DESC
LIMIT 10;

-- 6. Sample markets ended để xem chi tiết
SELECT 
  id,
  slug,
  status,
  index_15m,
  TO_TIMESTAMP(start_timestamp) as start_date,
  TO_TIMESTAMP(end_timestamp) as end_date,
  open_price,
  close_price,
  type_win,
  created_at,
  updated_at
FROM market_registry
WHERE status = 'ended'
ORDER BY end_timestamp DESC
LIMIT 10;

-- 7. Kiểm tra markets có slug trùng (không nên xảy ra vì có unique constraint)
-- Nếu có kết quả, có thể do soft-deleted records
SELECT 
  slug,
  COUNT(*) as count,
  array_agg(id ORDER BY created_at) as ids,
  array_agg(status ORDER BY created_at) as statuses,
  array_agg(deleted_at IS NOT NULL ORDER BY created_at) as is_deleted
FROM market_registry
GROUP BY slug
HAVING COUNT(*) > 1;

