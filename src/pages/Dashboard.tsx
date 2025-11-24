import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Navbar from "@/components/Navbar";
import RankBadge from "@/components/RankBadge";
import { Trophy, Swords, TrendingUp, User as UserIcon } from "lucide-react";

const Dashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUser(session.user);
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
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  if (!user) return null;

  // Mock data - will be replaced with real data from database
  const mockProfile = {
    nickname: user.user_metadata?.nickname || "Player",
    elo: 1200,
    rank: "Hero",
    gamesPlayed: 0,
    wins: 0,
    winrate: 0,
    region: "EU",
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 pt-24 pb-12">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Profile Card */}
          <Card className="lg:col-span-2 border-border/50 bg-gradient-to-br from-card to-card/50">
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-full bg-primary/20 flex items-center justify-center">
                  <UserIcon className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-2xl">{mockProfile.nickname}</CardTitle>
                  <p className="text-sm text-muted-foreground">Region: {mockProfile.region}</p>
                </div>
              </div>
              <RankBadge rank={mockProfile.rank} size="lg" />
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <div className="text-3xl font-bold text-primary">{mockProfile.elo}</div>
                  <div className="text-xs text-muted-foreground uppercase">ELO Rating</div>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <div className="text-3xl font-bold">{mockProfile.gamesPlayed}</div>
                  <div className="text-xs text-muted-foreground uppercase">Matches</div>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <div className="text-3xl font-bold text-accent">{mockProfile.wins}</div>
                  <div className="text-xs text-muted-foreground uppercase">Wins</div>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <div className="text-3xl font-bold">{mockProfile.winrate}%</div>
                  <div className="text-xs text-muted-foreground uppercase">Win Rate</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button className="w-full gap-2" size="lg">
                <Swords className="h-5 w-5" />
                Find Match
              </Button>
              <Button variant="outline" className="w-full gap-2" onClick={() => navigate("/ladder")}>
                <Trophy className="h-5 w-5" />
                View Rankings
              </Button>
              <Button variant="outline" className="w-full gap-2">
                <TrendingUp className="h-5 w-5" />
                Match History
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Recent Matches Placeholder */}
        <Card className="mt-6 border-border/50">
          <CardHeader>
            <CardTitle>Historial de partidos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12 text-muted-foreground">
              <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Sin partidos aún.</p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Dashboard;
