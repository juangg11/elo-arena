import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Navbar from "@/components/Navbar";
import RankBadge from "@/components/RankBadge";
import { Trophy, Swords, TrendingUp, User as UserIcon, Calendar, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Footer from "@/components/Footer";

interface Profile {
  id: string;
  nickname: string;
  elo: number;
  rank: string;
  games_played: number;
  wins: number;
  region: string;
  avatar_url: string | null;
}

interface MatchHistory {
  id: string;
  created_at: string;
  status: string;
  winner_id: string | null;
  player1_id: string;
  player2_id: string;
  player1_elo: number;
  player2_elo: number;
  player1_profile: {
    id: string;
    nickname: string;
    avatar_url: string | null;
  };
  player2_profile: {
    id: string;
    nickname: string;
    avatar_url: string | null;
  };
}

const Dashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [matchHistory, setMatchHistory] = useState<MatchHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMatches, setLoadingMatches] = useState(true);
  const navigate = useNavigate();

  const fetchMatchHistory = useCallback(async (profileId: string) => {
    setLoadingMatches(true);
    try {
      const { data, error } = await supabase
        .from("matches")
        .select(`
          id,
          created_at,
          status,
          winner_id,
          player1_id,
          player2_id,
          player1_elo,
          player2_elo,
          player1_profile:profiles!matches_player1_id_fkey(id, nickname, avatar_url),
          player2_profile:profiles!matches_player2_id_fkey(id, nickname, avatar_url)
        `)
        .or(`player1_id.eq.${profileId},player2_id.eq.${profileId}`)
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(3);

      if (error) {
        console.error("Error fetching match history:", error);
      } else if (data) {
        setMatchHistory(data as unknown as MatchHistory[]);
      }
    } catch (err) {
      console.error("Error:", err);
    }
    setLoadingMatches(false);
  }, []);

  useEffect(() => {
    const fetchProfile = async (userId: string) => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (data) {
        setProfile(data);
        // Fetch match history after getting profile
        fetchMatchHistory(data.id);
      }
      setLoading(false);
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUser(session.user);
        fetchProfile(session.user.id);
      } else {
        navigate("/auth");
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session) {
        navigate("/auth");
      } else {
        fetchProfile(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, fetchMatchHistory]);

  // Subscribe to profile changes for real-time updates
  useEffect(() => {
    if (!profile?.id) return;

    const profileChannel = supabase
      .channel(`profile-${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${profile.id}`
        },
        () => {
          // Refresh profile when it changes
          if (user) {
            supabase
              .from('profiles')
              .select('*')
              .eq('user_id', user.id)
              .single()
              .then(({ data, error }) => {
                if (error) {
                  console.error('Error refreshing profile:', error);
                } else if (data) {
                  console.log('Profile updated, refreshing data:', data);
                  setProfile(data);
                  // Also refresh match history
                  if (data.id) {
                    fetchMatchHistory(data.id);
                  }
                }
              });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(profileChannel);
    };
  }, [profile?.id, user, fetchMatchHistory]);

  if (!user || loading || !profile) return null;

  const winrate = profile.games_played > 0
    ? Math.round((profile.wins / profile.games_played) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="container mx-auto px-4 pt-24 pb-12">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Profile Card */}
          <Card className="lg:col-span-2 border-border/50 bg-gradient-to-br from-card to-card/50">
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16 border-2 border-primary/20">
                  <AvatarImage src={profile.avatar_url || ""} alt={profile.nickname} />
                  <AvatarFallback className="bg-primary/10">
                    <UserIcon className="h-8 w-8 text-primary" />
                  </AvatarFallback>
                </Avatar>
                <div>
                  <CardTitle className="text-2xl">{profile.nickname}</CardTitle>
                  <p className="text-sm text-muted-foreground">Region: {profile.region}</p>
                </div>
              </div>
              <RankBadge rank={profile.rank} size="lg" />
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <div className="text-3xl font-bold text-primary">{profile.elo}</div>
                  <div className="text-xs text-muted-foreground uppercase">ELO Rating</div>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <div className="text-3xl font-bold">{profile.games_played}</div>
                  <div className="text-xs text-muted-foreground uppercase">Matches</div>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <div className="text-3xl font-bold text-accent">{profile.wins}</div>
                  <div className="text-xs text-muted-foreground uppercase">Wins</div>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <div className="text-3xl font-bold">{winrate}%</div>
                  <div className="text-xs text-muted-foreground uppercase">Win Rate</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle>Acciones rápidas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button className="w-full gap-2" size="lg" onClick={() => navigate("/matchmaking")}>
                <Swords className="h-5 w-5" />
                Buscar partido
              </Button>
              <Button variant="outline" className="w-full gap-2" onClick={() => navigate("/ladder")}>
                <Trophy className="h-5 w-5" />
                Ver Rankings
              </Button>
              <Button variant="outline" className="w-full gap-2" onClick={() => navigate("/history")}>
                <TrendingUp className="h-5 w-5" />
                Historial de partidos
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Recent Matches */}
        <Card className="mt-6 border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Últimos partidos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingMatches ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : matchHistory.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Sin partidos completados aún.</p>
                <Button 
                  variant="outline" 
                  className="mt-4"
                  onClick={() => navigate("/matchmaking")}
                >
                  Buscar tu primera partida
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {matchHistory.map((match) => {
                  const isPlayer1 = match.player1_id === profile?.id;
                  const myProfile = isPlayer1 ? match.player1_profile : match.player2_profile;
                  const opponentProfile = isPlayer1 ? match.player2_profile : match.player1_profile;
                  const myElo = isPlayer1 ? match.player1_elo : match.player2_elo;
                  const opponentElo = isPlayer1 ? match.player2_elo : match.player1_elo;
                  const isWin = match.winner_id === profile?.id;
                  const matchDate = new Date(match.created_at);

                  return (
                    <div
                      key={match.id}
                      className={`relative overflow-hidden rounded-lg border-2 p-4 transition-all hover:shadow-md ${
                        isWin 
                          ? 'border-green-500/50 bg-green-500/5' 
                          : 'border-red-500/50 bg-red-500/5'
                      }`}
                    >
                      {/* Win/Loss indicator bar */}
                      <div 
                        className={`absolute left-0 top-0 bottom-0 w-1 ${
                          isWin ? 'bg-green-500' : 'bg-red-500'
                        }`} 
                      />
                      
                      <div className="flex items-center justify-between pl-3">
                        {/* Names with VS in center */}
                        <div className="flex items-center justify-center gap-3 flex-1">
                          <div className="text-right flex-1">
                            <div className="font-bold text-base">{myProfile?.nickname || "Tú"}</div>
                            <div className="text-xs text-muted-foreground">{myElo} ELO</div>
                          </div>
                          
                          <div className="flex flex-col items-center px-3">
                            <span className={`text-lg font-bold ${isWin ? 'text-green-500' : 'text-red-500'}`}>
                              VS
                            </span>
                          </div>
                          
                          <div className="text-left flex-1">
                            <div className="font-bold text-base">{opponentProfile?.nickname || "Rival"}</div>
                            <div className="text-xs text-muted-foreground">{opponentElo} ELO</div>
                          </div>
                        </div>

                        {/* Result & Date */}
                        <div className="flex flex-col items-end text-right ml-4 min-w-[80px]">
                          <span className={`text-xs font-bold ${isWin ? 'text-green-500' : 'text-red-500'}`}>
                            {isWin ? 'VICTORIA' : 'DERROTA'}
                          </span>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                            <Calendar className="h-3 w-3" />
                            <span>{matchDate.toLocaleDateString('es-ES', { 
                              day: '2-digit', 
                              month: 'short'
                            })}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
      
      <Footer />
    </div>
  );
};

export default Dashboard;
