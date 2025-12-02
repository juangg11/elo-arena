-- Create trigger to automatically clean up matchmaking queue when match is finalized
-- This prevents residual matches from staying in the queue forever

-- Function that will be called by the trigger
CREATE OR REPLACE FUNCTION public.cleanup_matchmaking_queue_on_match_finalize()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- When a match is completed or reported, delete the corresponding queue entries
    IF (NEW.status = 'completed' OR NEW.status = 'reported') AND 
       (OLD.status IS NULL OR OLD.status = 'pending') THEN
        
        DELETE FROM matchmaking_queue
        WHERE match_id = NEW.id;
        
        -- Log for debugging (optional, can be removed in production)
        RAISE NOTICE 'Cleaned up matchmaking queue for match %', NEW.id;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS trigger_cleanup_queue_on_match_finalize ON public.matches;

CREATE TRIGGER trigger_cleanup_queue_on_match_finalize
    AFTER UPDATE ON public.matches
    FOR EACH ROW
    WHEN (NEW.status IN ('completed', 'reported'))
    EXECUTE FUNCTION public.cleanup_matchmaking_queue_on_match_finalize();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.cleanup_matchmaking_queue_on_match_finalize TO authenticated;
