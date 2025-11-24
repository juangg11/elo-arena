import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import RankBadge from "@/components/RankBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, Medal, Crown } from "lucide-react";

interface Player {
  rank: number;
  nickname: string;
  elo: number;
  rankName: string;
  wins: number;
  losses: number;
  region: string;
}

const Ladder = () => {
  const [selectedRegion, setSelectedRegion] = useState("global");
  const [leaderboard, setLeaderboard] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard();
  }, [selectedRegion]);

  const fetchLeaderboard = async () => {
    setLoading(true);
    let query = supabase
      .from("profiles")
      .select("*")
      .order("elo", { ascending: false })
      .limit(50);

    if (selectedRegion !== "global") {
      query = query.eq("region", selectedRegion);
    }

    const { data, error } = await query;

    if (data) {
      const formattedData: Player[] = data.map((profile, index) => ({
        rank: index + 1,
        nickname: profile.nickname,
        elo: profile.elo,
        rankName: profile.rank,
        wins: profile.wins,
        losses: profile.games_played - profile.wins,
        region: profile.region,
      }));
      setLeaderboard(formattedData);
    }
    setLoading(false);
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Crown className="h-5 w-5 text-accent" />;
    if (rank === 2) return <Medal className="h-5 w-5 text-rank-silver" />;
    if (rank === 3) return <Medal className="h-5 w-5 text-rank-bronze" />;
    return <span className="text-muted-foreground">#{rank}</span>;
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 pt-24 pb-12">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent inline-block">
            Rankings
          </h1>
          <p className="text-muted-foreground">
            Compite para llegar a los tops de las ladders.
          </p>
        </div>

          <Tabs defaultValue="global" onValueChange={setSelectedRegion} className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-3 mx-auto">
            <TabsTrigger value="global">Global</TabsTrigger>
            <TabsTrigger value="EU">España</TabsTrigger>
            <TabsTrigger value="NA">Francia</TabsTrigger>
          </TabsList>

          <TabsContent value={selectedRegion} className="space-y-4">
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center justify-center gap-2 text-center">
                  Jugadores
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8 text-muted-foreground">Cargando...</div>
                ) : leaderboard.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">No hay jugadores en esta región</div>
                ) : (
                  <div className="space-y-3">
                    {leaderboard.map((player) => (
                    <div
                      key={player.rank}
                      className="flex items-center justify-between p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors border border-border/50"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 flex justify-center">
                          {getRankIcon(player.rank)}
                        </div>
                        <div>
                          <div className="font-bold text-lg">{player.nickname}</div>
                          <div className="text-sm text-muted-foreground">
                            {player.wins}W - {player.losses}L
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="min-w-[6rem] text-center">
                          <div className="text-2xl font-bold text-primary">{player.elo}</div>
                          <div className="text-xs text-muted-foreground">ELO</div>
                        </div>
                        <RankBadge rank={player.rankName} />
                      </div>
                    </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Rank Divisions Info */}
        <Card className="mt-8 border-border/50">
          <CardHeader>
            <CardTitle className="text-center">Divisiones</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { name: "novato", range: "0-499" },
                { name: "aspirante", range: "500-799" },
                { name: "promesa", range: "800-1199" },
                { name: "relampago", range: "1200-1399" },
                { name: "tormenta", range: "1400-1599" },
                { name: "supernova", range: "1600-1799" },
                { name: "inazuma", range: "1800-2499" },
                { name: "heroe", range: <>2500-<span className="text-sm relative down-0.5">∞</span></> },
              ].map((division) => (
                  <div
                    key={division.name}
                    className="text-center p-3 rounded-lg border border-border/30"
                    style={{
                      backgroundColor: `hsl(var(--rank-${division.name}))`,
                      color: 'hsl(0, 0%, 50%)', // gris medio
                    }}
                  >
                  <RankBadge rank={division.name} size="sm" />
                  <div className="text-xs mt-2">{division.range} ELO</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Ladder;
