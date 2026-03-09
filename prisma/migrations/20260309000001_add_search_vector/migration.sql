-- AlterTable: Add search_vector column for full-text search
ALTER TABLE houston_bot_reports 
ADD COLUMN search_vector tsvector;

-- Create GIN index for fast full-text search
CREATE INDEX houston_bot_reports_search_vector_idx 
ON houston_bot_reports 
USING gin(search_vector);

-- Update existing reports with search vectors
UPDATE houston_bot_reports 
SET search_vector = to_tsvector('portuguese', title || ' ' || COALESCE(description, ''));
