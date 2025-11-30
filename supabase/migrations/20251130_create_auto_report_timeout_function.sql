-- Create function to automatically report matches where timeout expired
-- This function creates a report when a player doesn't declare result within 10 minutes

CREATE OR REPLACE FUNCTION public.auto_report_timeout_match(
    p_match_id UUID
)
RETURNS TABLE(
    success BOOLEAN,
    error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_match RECORD;
    v_reporter_id UUID;
    v_reporter_user_id UUID;
    v_opponent_id UUID;
    v_timeout_minutes INTEGER := 10;
BEGIN
    -- Get match details
    SELECT 
        m.*,
        CASE 
            WHEN m.result_a IS NOT NULL THEN m.player1_id
            WHEN m.result_b IS NOT NULL THEN m.player2_id
            ELSE NULL
        END as declared_player_id,
        CASE 
            WHEN m.result_a IS NOT NULL THEN m.player2_id
            WHEN m.result_b IS NOT NULL THEN m.player1_id
            ELSE NULL
        END as opponent_player_id
    INTO v_match
    FROM matches m
    WHERE m.id = p_match_id
    AND m.status = 'pending'
    AND m.first_result_at IS NOT NULL
    AND EXTRACT(EPOCH FROM (NOW() - m.first_result_at)) / 60 >= v_timeout_minutes;
    
    -- Check if match exists and timeout expired
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'Match not found or timeout not expired'::TEXT;
        RETURN;
    END IF;
    
    -- Check if already reported
    IF EXISTS (SELECT 1 FROM reports WHERE match_id = p_match_id) THEN
        RETURN QUERY SELECT FALSE, 'Match already reported'::TEXT;
        RETURN;
    END IF;
    
    -- Get reporter profile (the one who declared result)
    v_reporter_id := v_match.declared_player_id;
    v_opponent_id := v_match.opponent_player_id;
    
    -- Get user_id from profile
    SELECT user_id INTO v_reporter_user_id
    FROM profiles
    WHERE id = v_reporter_id;
    
    IF v_reporter_user_id IS NULL THEN
        RETURN QUERY SELECT FALSE, 'Reporter user_id not found'::TEXT;
        RETURN;
    END IF;
    
    -- Create automatic report
    INSERT INTO reports (
        match_id,
        reporter_id,
        reason,
        description,
        status
    ) VALUES (
        p_match_id,
        v_reporter_user_id,
        'Timeout',
        'El oponente no declaró resultado dentro del tiempo límite de 10 minutos. Reporte automático generado por el sistema.',
        'pending'
    );
    
    -- Update match status to reported
    UPDATE matches
    SET status = 'reported'
    WHERE id = p_match_id;
    
    -- Update games_played for both players
    UPDATE profiles
    SET games_played = games_played + 1
    WHERE id IN (v_reporter_id, v_opponent_id);
    
    RETURN QUERY SELECT TRUE, NULL::TEXT;
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN QUERY SELECT FALSE, SQLERRM::TEXT;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.auto_report_timeout_match TO authenticated;

