-- Add discord column to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS discord TEXT;

-- Add comment to the column
COMMENT ON COLUMN public.profiles.discord IS 'Discord username of the user';
