-- Fix ambiguous match_id reference in create_match_atomic function
-- The issue was that match_id could refer to either the RETURNS TABLE column or the table column

CREATE OR REPLACE FUNCTION public.create_match_atomic(
    p_player1_queue_id UUID,
    p_player2_queue_id UUID,
    p_player1_profile_id UUID,
    p_player2_profile_id UUID,
    p_player1_elo INTEGER,
    p_player2_elo INTEGER
)
RETURNS TABLE(
    match_id UUID,
    success BOOLEAN,
    error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_match_id UUID;
    v_player1_status TEXT;
    v_player2_status TEXT;
    v_player1_match_id UUID;
    v_player2_match_id UUID;
    v_existing_match_id UUID;
BEGIN
    -- Lock both queue entries to prevent concurrent modifications
    -- First, verify player1 is still searching
    SELECT status, matchmaking_queue.match_id INTO v_player1_status, v_player1_match_id
    FROM matchmaking_queue
    WHERE id = p_player1_queue_id
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT NULL::UUID, FALSE, 'Player 1 not found in queue'::TEXT;
        RETURN;
    END IF;
    
    IF v_player1_status != 'searching' OR v_player1_match_id IS NOT NULL THEN
        RETURN QUERY SELECT NULL::UUID, FALSE, 'Player 1 is already matched'::TEXT;
        RETURN;
    END IF;
    
    -- Verify player2 is still searching
    SELECT status, matchmaking_queue.match_id INTO v_player2_status, v_player2_match_id
    FROM matchmaking_queue
    WHERE id = p_player2_queue_id
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT NULL::UUID, FALSE, 'Player 2 not found in queue'::TEXT;
        RETURN;
    END IF;
    
    IF v_player2_status != 'searching' OR v_player2_match_id IS NOT NULL THEN
        RETURN QUERY SELECT NULL::UUID, FALSE, 'Player 2 is already matched'::TEXT;
        RETURN;
    END IF;
    
    -- Check if a match already exists between these two players
    SELECT id INTO v_existing_match_id
    FROM matches
    WHERE status = 'pending'
    AND (
        (player1_id = p_player1_profile_id AND player2_id = p_player2_profile_id)
        OR (player1_id = p_player2_profile_id AND player2_id = p_player1_profile_id)
    )
    LIMIT 1;
    
    IF v_existing_match_id IS NOT NULL THEN
        -- Match already exists, update queue entries to point to it
        UPDATE matchmaking_queue
        SET status = 'matched',
            matched_with = CASE 
                WHEN id = p_player1_queue_id THEN p_player2_queue_id
                ELSE p_player1_queue_id
            END,
            match_id = v_existing_match_id
        WHERE id IN (p_player1_queue_id, p_player2_queue_id)
        AND status = 'searching'
        AND matchmaking_queue.match_id IS NULL;
        
        RETURN QUERY SELECT v_existing_match_id, TRUE, NULL::TEXT;
        RETURN;
    END IF;
    
    -- Create the match
    INSERT INTO matches (player1_id, player2_id, player1_elo, player2_elo, status)
    VALUES (p_player1_profile_id, p_player2_profile_id, p_player1_elo, p_player2_elo, 'pending')
    RETURNING id INTO v_match_id;
    
    -- Update both queue entries atomically
    UPDATE matchmaking_queue
    SET status = 'matched',
        matched_with = CASE 
            WHEN id = p_player1_queue_id THEN p_player2_queue_id
            ELSE p_player1_queue_id
        END,
        match_id = v_match_id
    WHERE id IN (p_player1_queue_id, p_player2_queue_id)
    AND status = 'searching'
    AND matchmaking_queue.match_id IS NULL;
    
    -- Verify both updates succeeded by checking row count
    IF (SELECT COUNT(*) FROM matchmaking_queue WHERE id IN (p_player1_queue_id, p_player2_queue_id) AND matchmaking_queue.match_id = v_match_id) != 2 THEN
        -- Rollback: delete the match and return error
        DELETE FROM matches WHERE id = v_match_id;
        RETURN QUERY SELECT NULL::UUID, FALSE, 'Failed to update queue entries'::TEXT;
        RETURN;
    END IF;
    
    RETURN QUERY SELECT v_match_id, TRUE, NULL::TEXT;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.create_match_atomic TO authenticated;

