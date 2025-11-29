-- Fix matches status constraint - more robust version
-- This will work even if the constraint doesn't exist or has a different name

-- First, try to find and drop any existing status constraints
DO $$ 
DECLARE
    constraint_name text;
BEGIN
    -- Find the constraint name
    SELECT conname INTO constraint_name
    FROM pg_constraint 
    WHERE conrelid = 'public.matches'::regclass
    AND contype = 'c'
    AND conname LIKE '%status%';
    
    -- Drop it if found
    IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS %I', constraint_name);
        RAISE NOTICE 'Dropped constraint: %', constraint_name;
    END IF;
END $$;

-- Now add the correct constraint with all allowed status values
ALTER TABLE public.matches 
ADD CONSTRAINT matches_status_check 
CHECK (status IN ('pending', 'completed', 'reported', 'scheduled'));

-- Verify the constraint was created
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'matches_status_check'
        AND conrelid = 'public.matches'::regclass
    ) THEN
        RAISE NOTICE 'Constraint matches_status_check created successfully';
    ELSE
        RAISE EXCEPTION 'Failed to create constraint';
    END IF;
END $$;

