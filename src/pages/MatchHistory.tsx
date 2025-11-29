import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import Navbar from "@/components/Navbar";
import { Trophy, Calendar, Loader2, Search, ArrowLeft } from "lucide-react";

interface Profile {
  id: string;
  nickname: string;
  elo: number;
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

const MatchHistory = () => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [matchHistory, setMatchHistory] = useState<MatchHistory[]>([]);
  const [filteredMatches, setFilteredMatches] = useState<MatchHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/auth");
        return;
      }

      // Get profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", session.user.id)
        .single();

      if (profileData) {
        setProfile(profileData);
        await fetchMatchHistory(profileData.id);
      }
      setLoading(false);
    };

    fetchData();
  }, [navigate]);

  const fetchMatchHistory = async (profileId: string) => {
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
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching match history:", error);
      } else if (data) {
        const matches = data as unknown as MatchHistory[];
        setMatchHistory(matches);
        setFilteredMatches(matches);
      }
    } catch (err) {
      console.error("Error:", err);
    }
  };

  // Filter matches when search term changes
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredMatches(matchHistory);
      return;
    }

    const term = searchTerm.toLowerCase();
    const filtered = matchHistory.filter((match) => {
      const isPlayer1 = match.player1_id === profile?.id;
      const opponentProfile = isPlayer1 ? match.player2_profile : match.player1_profile;
      return opponentProfile?.nickname?.toLowerCase().includes(term);
    });

    setFilteredMatches(filtered);
  }, [searchTerm, matchHistory, profile?.id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container mx-auto px-4 pt-24 pb-12 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="container mx-auto px-4 pt-24 pb-12">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-4 mb-6">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-3xl font-bold">Historial de Partidos</h1>
          </div>

          {/* Search */}
          <Card className="mb-6 border-border/50">
            <CardContent className="pt-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nombre de rival..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              {searchTerm && (
                <p className="text-sm text-muted-foreground mt-2">
                  {filteredMatches.length} resultado{filteredMatches.length !== 1 ? 's' : ''} encontrado{filteredMatches.length !== 1 ? 's' : ''}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Match List */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5" />
                Todos los partidos ({filteredMatches.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredMatches.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>{searchTerm ? "No se encontraron partidos con ese rival." : "Sin partidos completados aún."}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredMatches.map((match) => {
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
                              <div className="text-xs text-muted-foreground">{myElo || '?'} ELO</div>
                            </div>
                            
                            <div className="flex flex-col items-center px-3">
                              <span className={`text-lg font-bold ${isWin ? 'text-green-500' : 'text-red-500'}`}>
                                VS
                              </span>
                            </div>
                            
                            <div className="text-left flex-1">
                              <div className="font-bold text-base">{opponentProfile?.nickname || "Rival"}</div>
                              <div className="text-xs text-muted-foreground">{opponentElo || '?'} ELO</div>
                            </div>
                          </div>

                          {/* Result & Date */}
                          <div className="flex flex-col items-end text-right ml-4 min-w-[100px]">
                            <span className={`text-xs font-bold ${isWin ? 'text-green-500' : 'text-red-500'}`}>
                              {isWin ? 'VICTORIA' : 'DERROTA'}
                            </span>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                              <Calendar className="h-3 w-3" />
                              <span>{matchDate.toLocaleDateString('es-ES', { 
                                day: '2-digit', 
                                month: 'short',
                                year: 'numeric'
                              })}</span>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {matchDate.toLocaleTimeString('es-ES', { 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              })}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default MatchHistory;

