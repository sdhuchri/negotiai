-- Final settlement terms (set when a deal is reached). Idempotent.
ALTER TABLE negotiations ADD COLUMN IF NOT EXISTS deal_price NUMERIC;
ALTER TABLE negotiations ADD COLUMN IF NOT EXISTS deal_lead_time_days INT;
