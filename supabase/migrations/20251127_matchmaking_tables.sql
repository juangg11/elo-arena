-- Migration to create matchmaking_queue and messages tables
-- Run this if the tables don't exist yet

-- Create matchmaking_queue table
CREATE TABLE IF NOT EXISTS public.matchmaking_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  elo INTEGER NOT NULL,
  region TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'searching',
  matched_with UUID REFERENCES public.matchmaking_queue(id),
  match_id UUID REFERENCES public.matches(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.matchmaking_queue ENABLE ROW LEVEL SECURITY;

-- Policies for matchmaking_queue
CREATE POLICY "Queue entries are viewable by everyone" 
ON public.matchmaking_queue 
FOR SELECT 
USING (true);

CREATE POLICY "Users can insert their own queue entry" 
ON public.matchmaking_queue 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own queue entry" 
ON public.matchmaking_queue 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own queue entry" 
ON public.matchmaking_queue 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create messages table
CREATE TABLE IF NOT EXISTS public.messages (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL
);

-- Enable RLS
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Policies for messages
CREATE POLICY "Messages are viewable by match participants" 
ON public.messages 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.matches 
    WHERE matches.id = messages.match_id 
    AND (matches.player_a_id = auth.uid() OR matches.player_b_id = auth.uid())
  )
);

CREATE POLICY "Match participants can insert messages" 
ON public.messages 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.matches 
    WHERE matches.id = match_id 
    AND (matches.player_a_id = auth.uid() OR matches.player_b_id = auth.uid())
  )
);

-- Add result_a and result_b columns to matches if they don't exist
ALTER TABLE public.matches 
ADD COLUMN IF NOT EXISTS result_a TEXT CHECK (result_a IN ('win', 'lose')),
ADD COLUMN IF NOT EXISTS result_b TEXT CHECK (result_b IN ('win', 'lose'));

-- Update matches table to use player1_id and player2_id instead of player_a_id and player_b_id
-- (This is to match the code in Matchmaking.tsx)
ALTER TABLE public.matches 
ADD COLUMN IF NOT EXISTS player1_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS player2_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_matchmaking_queue_status ON public.matchmaking_queue(status);
CREATE INDEX IF NOT EXISTS idx_matchmaking_queue_region ON public.matchmaking_queue(region);
CREATE INDEX IF NOT EXISTS idx_matchmaking_queue_elo ON public.matchmaking_queue(elo);
CREATE INDEX IF NOT EXISTS idx_messages_match_id ON public.messages(match_id);
CREATE INDEX IF NOT EXISTS idx_matches_status ON public.matches(status);
