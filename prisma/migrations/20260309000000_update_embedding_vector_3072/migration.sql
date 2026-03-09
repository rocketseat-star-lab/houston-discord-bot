-- AlterTable: Change embedding column from vector(1536) to vector(3072)
-- WARNING: This will delete all existing embeddings due to dimension mismatch
-- They need to be regenerated with the new model

-- Drop existing embeddings data
TRUNCATE TABLE houston_bot_report_embeddings;

-- Alter the column type
ALTER TABLE houston_bot_report_embeddings 
ALTER COLUMN embedding TYPE vector(3072);
