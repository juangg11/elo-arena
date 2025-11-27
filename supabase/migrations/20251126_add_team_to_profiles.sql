-- Add team field to profiles table
ALTER TABLE public.profiles
ADD COLUMN team TEXT;

-- Add comment to the column
COMMENT ON COLUMN public.profiles.team IS 'Optional team or organization name for the player';
