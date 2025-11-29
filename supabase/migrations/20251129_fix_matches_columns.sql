-- Add missing columns to matches table
ALTER TABLE public.matches 
ADD COLUMN IF NOT EXISTS player1_elo INTEGER,
ADD COLUMN IF NOT EXISTS player2_elo INTEGER,
ADD COLUMN IF NOT EXISTS winner_id UUID REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS first_result_at TIMESTAMP WITH TIME ZONE;

-- Make player1_id and player2_id not null if they exist
-- (Can't easily make existing nullable columns NOT NULL without data migration)

-- Update RLS policy to allow participants to update their matches
DROP POLICY IF EXISTS "Players can update their matches" ON public.matches;

CREATE POLICY "Players can update their matches" 
ON public.matches 
FOR UPDATE 
USING (
    player1_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    OR player2_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    OR player_a_id = auth.uid()
    OR player_b_id = auth.uid()
);

-- Allow insert for authenticated users
DROP POLICY IF EXISTS "Authenticated users can create matches" ON public.matches;

CREATE POLICY "Authenticated users can create matches"
ON public.matches
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

