import { useState } from "react";
import Navbar from "@/components/Navbar";
import RankBadge from "@/components/RankBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, Medal, Crown } from "lucide-react";

const Ladder = () => {
  const [selectedRegion, setSelectedRegion] = useState("global");

  // Mock leaderboard data - will be replaced with real data
  const mockLeaderboard = [
    { rank: 1, nickname: "ProGamer", elo: 2450, rankName: "Elite", wins: 156, losses: 44, region: "EU" },
    { rank: 2, nickname: "ChessM", elo: 2380, rankName: "Grandmaster", wins: 142, losses: 38, region: "NA" },
    { rank: 3, nickname: "Tactician", elo: 2310, rankName: "Grandmaster", wins: 128, losses: 42, region: "EU" },
    { rank: 4, nickname: "StrategyKing", elo: 2245, rankName: "Master", wins: 115, losses: 35, region: "LATAM" },
    { rank: 5, nickname: "CompPlayer", elo: 2180, rankName: "Master", wins: 98, losses: 32, region: "ASIA" },
  ];

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
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Global Rankings
          </h1>
          <p className="text-muted-foreground">
            Compete against the best players worldwide
          </p>
        </div>

        <Tabs defaultValue="global" onValueChange={setSelectedRegion} className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-4">
            <TabsTrigger value="global">Global</TabsTrigger>
            <TabsTrigger value="EU">EU</TabsTrigger>
            <TabsTrigger value="NA">NA</TabsTrigger>
            <TabsTrigger value="LATAM">LATAM</TabsTrigger>
          </TabsList>

          <TabsContent value={selectedRegion} className="space-y-4">
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-primary" />
                  Top Players
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {mockLeaderboard.map((player) => (
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
                        <div className="text-right">
                          <div className="text-2xl font-bold text-primary">{player.elo}</div>
                          <div className="text-xs text-muted-foreground">ELO</div>
                        </div>
                        <RankBadge rank={player.rankName} />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Rank Divisions Info */}
        <Card className="mt-8 border-border/50">
          <CardHeader>
            <CardTitle>Rank Divisions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { name: "Bronze", range: "0-799" },
                { name: "Silver", range: "800-999" },
                { name: "Gold", range: "1000-1199" },
                { name: "Platinum", range: "1200-1399" },
                { name: "Diamond", range: "1400-1599" },
                { name: "Master", range: "1600-1799" },
                { name: "Grandmaster", range: "1800-1999" },
                { name: "Elite", range: "2000+" },
              ].map((division) => (
                <div key={division.name} className="text-center p-3 rounded-lg bg-muted/30 border border-border/30">
                  <RankBadge rank={division.name} size="sm" />
                  <div className="text-xs text-muted-foreground mt-2">{division.range} ELO</div>
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
