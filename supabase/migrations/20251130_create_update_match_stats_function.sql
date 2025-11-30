-- Create RPC function to update match statistics securely
-- This function uses SECURITY DEFINER to bypass RLS restrictions
-- when updating profiles of both players after a match

CREATE OR REPLACE FUNCTION public.update_match_stats(
    p_winner_id UUID,
    p_loser_id UUID,
    p_winner_elo INTEGER,
    p_loser_elo INTEGER,
    p_winner_rank TEXT,
    p_loser_rank TEXT,
    p_winner_streak INTEGER,
    p_loser_streak INTEGER
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    winner_updated INTEGER;
    loser_updated INTEGER;
BEGIN
    -- Update winner profile
    UPDATE public.profiles
    SET 
        elo = p_winner_elo,
        rank = p_winner_rank,
        wins = wins + 1,
        games_played = games_played + 1,
        current_streak = p_winner_streak,
        updated_at = now()
    WHERE id = p_winner_id;
    
    GET DIAGNOSTICS winner_updated = ROW_COUNT;
    
    -- Update loser profile
    UPDATE public.profiles
    SET 
        elo = p_loser_elo,
        rank = p_loser_rank,
        games_played = games_played + 1,
        current_streak = p_loser_streak,
        updated_at = now()
    WHERE id = p_loser_id;
    
    GET DIAGNOSTICS loser_updated = ROW_COUNT;
    
    -- Verify both updates succeeded
    IF winner_updated = 0 OR loser_updated = 0 THEN
        RAISE EXCEPTION 'Failed to update profiles. Winner: %, Loser: %', winner_updated, loser_updated;
    END IF;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.update_match_stats TO authenticated;

