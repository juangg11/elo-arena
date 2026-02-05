import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import RankBadge from "@/components/RankBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, Medal, Crown, User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Footer from "@/components/Footer";
import ladderBg from "@/assets/ladder.jpg";

const DiscordIcon = () => (
  <svg
    className="h-4 w-4"
    viewBox="0 0 24 24"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
  </svg>
);

interface Player {
  rank: number;
  nickname: string;
  elo: number;
  rankName: string;
  wins: number;
  losses: number;
  team: string | null;
  avatar_url: string | null;
  discord: string | null;
}

const Ladder = () => {
  const [selectedTeam, setSelectedTeam] = useState("global");
  const [leaderboard, setLeaderboard] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard();
  }, [selectedTeam]);

  const fetchLeaderboard = async () => {
    setLoading(true);

    let query = supabase
      .from("profiles")
      .select("*")
      .order("elo", { ascending: false })
      .limit(50);

    if (selectedTeam !== "global") {
      query = query.eq("team", selectedTeam);
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
        team: profile.team,
        avatar_url: profile.avatar_url,
        discord: profile.discord,
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
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      <Tabs defaultValue="global" onValueChange={setSelectedTeam} className="space-y-0 flex-1 flex flex-col">
        {/* Hero Section with Background */}
        <section className="relative pt-32 pb-12 overflow-hidden">
          <div
            className="absolute inset-0 opacity-60"
            style={{
              backgroundImage: `url(${ladderBg})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center 60%',
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/90 to-background" />

          <div className="container mx-auto px-4 relative z-10">
            <div className="text-center space-y-8">
              <div className="space-y-4">
                <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent inline-block">
                  Rankings
                </h1>
                <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                  Compite para llegar a los tops de las ladders.
                </p>
              </div>

              <TabsList className="grid w-full max-w-2xl grid-cols-3 mx-auto bg-background/50 backdrop-blur-sm border border-border/50">
                <TabsTrigger value="global">Global</TabsTrigger>
                <TabsTrigger value="A">Team A</TabsTrigger>
                <TabsTrigger value="B">Team B</TabsTrigger>
              </TabsList>
            </div>
          </div>
        </section>

        <main className="container mx-auto px-4 pb-12 flex-1">
          {/* Contenido único que persiste */}
          <div className="space-y-4">
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
                  <div className="text-center py-8 text-muted-foreground">
                    No hay jugadores en este equipo
                  </div>
                ) : (
                  <div className="space-y-3">
                    {leaderboard.slice(0, 10).map((player) => (
                      <div
                        key={`${player.team}-${player.nickname}-${player.rank}`}
                        className="flex items-center justify-between p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors border border-border/50"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 flex justify-center">
                            {getRankIcon(player.rank)}
                          </div>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10 border border-primary/20">
                              <AvatarImage src={player.avatar_url || ""} alt={player.nickname} />
                              <AvatarFallback className="bg-primary/10">
                                <User className="h-5 w-5 text-primary" />
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-bold text-lg">{player.nickname}</div>
                              <div className="text-sm text-muted-foreground">
                                {player.wins}W - {player.losses}L
                              </div>
                            </div>
                            {player.discord && (
                              <div className="flex items-center gap-2 min-w-[8rem] border-l pl-4">
                                <div className="text-[#5865F2]">
                                  <DiscordIcon />
                                </div>
                                <span className="text-sm text-muted-foreground">{player.discord}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="w-[6rem] text-center">
                            <div className="text-2xl font-bold text-primary">{player.elo}</div>
                            <div className="text-xs text-muted-foreground">ELO</div>
                          </div>
                          <div className="flex justify-center">
                            <RankBadge rank={player.rankName} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

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
                  { name: "heroe", range: "2500-∞" },
                ].map((division) => (
                  <div
                    key={division.name}
                    className="text-center p-3 rounded-lg border border-border/30 bg-muted/20"
                  >
                    <RankBadge rank={division.name} size="sm" />
                    <div className="text-xs mt-2 text-muted-foreground">{division.range} ELO</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </main>
      </Tabs>

      <Footer />
    </div>
  );
};

export default Ladder;