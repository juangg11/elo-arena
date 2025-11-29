-- Add timestamp for when first result was submitted (for 10 min timeout)
ALTER TABLE public.matches 
ADD COLUMN IF NOT EXISTS first_result_at TIMESTAMP WITH TIME ZONE;

-- Add comment explaining the field
COMMENT ON COLUMN public.matches.first_result_at IS 'Timestamp when the first player submitted their result. Used for 10 minute timeout.';

