-- Fix matches status constraint to allow 'reported'
-- First, drop existing constraint if it exists
DO $$ 
BEGIN
    -- Drop the constraint if it exists
    IF EXISTS (
        SELECT 1 
        FROM pg_constraint 
        WHERE conname = 'matches_status_check'
    ) THEN
        ALTER TABLE public.matches DROP CONSTRAINT matches_status_check;
    END IF;
END $$;

-- Add new constraint that allows 'pending', 'completed', 'reported', and 'scheduled'
ALTER TABLE public.matches 
ADD CONSTRAINT matches_status_check 
CHECK (status IN ('pending', 'completed', 'reported', 'scheduled'));

-- Ensure reports table has description column (in case it doesn't exist)
ALTER TABLE public.reports 
ADD COLUMN IF NOT EXISTS description text;

-- Ensure reports table has evidence_url column (in case it doesn't exist)
ALTER TABLE public.reports 
ADD COLUMN IF NOT EXISTS evidence_url text;

