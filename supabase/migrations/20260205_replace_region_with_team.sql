-- Remove region field and add team field
-- This migration replaces region with team (A/B/None)

-- Add team column to profiles if it doesn't exist
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS team TEXT;

-- Drop region column from profiles
ALTER TABLE public.profiles DROP COLUMN IF EXISTS region;

-- Drop region column from matchmaking_queue if it exists
ALTER TABLE public.matchmaking_queue DROP COLUMN IF EXISTS region;

-- Update the handle_new_user function to use team instead of region
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, nickname, team)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'nickname', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'team'  -- Can be 'A', 'B', or NULL
  );
  RETURN NEW;
END;
$$;
