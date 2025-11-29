-- Add streak tracking columns to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS win_streak INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS loss_streak INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS current_streak INTEGER DEFAULT 0; -- positive = wins, negative = losses

-- Add ELO change tracking to matches
ALTER TABLE public.matches
ADD COLUMN IF NOT EXISTS elo_change_player1 INTEGER,
ADD COLUMN IF NOT EXISTS elo_change_player2 INTEGER;

-- Comment on columns
COMMENT ON COLUMN public.profiles.current_streak IS 'Current streak: positive = consecutive wins, negative = consecutive losses';
COMMENT ON COLUMN public.matches.elo_change_player1 IS 'ELO points gained/lost by player 1 (positive = gain, negative = loss)';
COMMENT ON COLUMN public.matches.elo_change_player2 IS 'ELO points gained/lost by player 2 (positive = gain, negative = loss)';

