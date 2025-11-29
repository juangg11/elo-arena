-- Complete migration to ensure reports table has all required columns
-- This will create the table if it doesn't exist and add missing columns

-- Create table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.reports (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
    reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    description text,
    evidence_url text,
    status text DEFAULT 'pending',
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add missing columns if they don't exist
DO $$ 
BEGIN
    -- Add reason column (some databases use this instead of description)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'reports' 
        AND column_name = 'reason'
    ) THEN
        ALTER TABLE public.reports ADD COLUMN reason text;
        RAISE NOTICE 'Added reason column';
    END IF;

    -- Add description column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'reports' 
        AND column_name = 'description'
    ) THEN
        ALTER TABLE public.reports ADD COLUMN description text;
        RAISE NOTICE 'Added description column';
    END IF;
    
    -- If reason exists but description doesn't, copy data from reason to description
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'reports' 
        AND column_name = 'reason'
    ) AND EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'reports' 
        AND column_name = 'description'
    ) THEN
        UPDATE public.reports SET description = reason WHERE description IS NULL AND reason IS NOT NULL;
    END IF;

    -- Add evidence_url column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'reports' 
        AND column_name = 'evidence_url'
    ) THEN
        ALTER TABLE public.reports ADD COLUMN evidence_url text;
        RAISE NOTICE 'Added evidence_url column';
    END IF;

    -- Add status column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'reports' 
        AND column_name = 'status'
    ) THEN
        ALTER TABLE public.reports ADD COLUMN status text DEFAULT 'pending';
        RAISE NOTICE 'Added status column';
    END IF;

    -- Add created_at column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'reports' 
        AND column_name = 'created_at'
    ) THEN
        ALTER TABLE public.reports ADD COLUMN created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL;
        RAISE NOTICE 'Added created_at column';
    END IF;
END $$;

-- Enable RLS
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policies
DROP POLICY IF EXISTS "Users can insert their own reports" ON public.reports;
DROP POLICY IF EXISTS "Admins can view all reports" ON public.reports;
DROP POLICY IF EXISTS "Users can view their own reports" ON public.reports;

-- Create policies
CREATE POLICY "Users can insert their own reports"
    ON public.reports FOR INSERT
    WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Users can view their own reports"
    ON public.reports FOR SELECT
    USING (auth.uid() = reporter_id);

CREATE POLICY "Admins can view all reports"
    ON public.reports FOR SELECT
    USING (true);

