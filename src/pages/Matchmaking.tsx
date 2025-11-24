import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import RankBadge from "@/components/RankBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Search, Trophy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Profile {
  nickname: string;
  elo: number;
  rank: string;
  region: string;
}

const Matchmaking = () => {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const fetchData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/auth");
        return;
      }

      setUser(session.user);
      
      const { data: profileData, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", session.user.id)
        .single();

      if (profileData) {
        setProfile(profileData);
      }
      
      setLoading(false);
    };

    fetchData();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleStartSearch = () => {
    setIsSearching(true);
    toast({
      title: "Buscando partida",
      description: `Buscando oponente con ELO similar (${profile?.elo || 1200})...`,
    });

    // Simulación de búsqueda (reemplazar con lógica real)
    setTimeout(() => {
      setIsSearching(false);
      toast({
        title: "Función en desarrollo",
        description: "El matchmaking completo estará disponible pronto.",
      });
    }, 3000);
  };

  const handleCancelSearch = () => {
    setIsSearching(false);
    toast({
      title: "Búsqueda cancelada",
      description: "Has salido de la cola de matchmaking.",
    });
  };

  if (loading || !profile) {
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
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Player Info Card */}
          <Card className="border-border/50 bg-gradient-to-br from-card to-card/50">
            <CardHeader>
              <CardTitle className="text-center">Tu Perfil</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold">{profile.nickname}</h3>
                  <p className="text-sm text-muted-foreground">Región: {profile.region}</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-primary">{profile.elo}</div>
                    <div className="text-xs text-muted-foreground">ELO</div>
                  </div>
                  <RankBadge rank={profile.rank} size="lg" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Matchmaking Card */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-center flex items-center justify-center gap-2">
                <Search className="h-5 w-5" />
                Búsqueda de Partida
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {isSearching ? (
                <div className="text-center space-y-4 py-8">
                  <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
                  <div>
                    <h3 className="text-xl font-bold mb-2">Buscando oponente...</h3>
                    <p className="text-muted-foreground">
                      Buscando jugadores con ELO similar ({profile.elo - 50} - {profile.elo + 50})
                    </p>
                  </div>
                  <Button 
                    variant="destructive" 
                    onClick={handleCancelSearch}
                    className="mt-4"
                  >
                    Cancelar búsqueda
                  </Button>
                </div>
              ) : (
                <div className="text-center space-y-4 py-8">
                  <Trophy className="h-12 w-12 mx-auto text-primary opacity-50" />
                  <div>
                    <h3 className="text-xl font-bold mb-2">¿Listo para competir?</h3>
                    <p className="text-muted-foreground">
                      Encuentra oponentes de tu nivel y demuestra tus habilidades
                    </p>
                  </div>
                  <Button 
                    size="lg" 
                    onClick={handleStartSearch}
                    className="mt-4 gap-2"
                  >
                    <Search className="h-5 w-5" />
                    Buscar Partida Ranked
                  </Button>
                </div>
              )}

              {/* Info Section */}
              <div className="border-t border-border/50 pt-4 mt-6">
                <h4 className="font-semibold mb-3 text-center">Cómo funciona</h4>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>• Te emparejaremos con jugadores de tu mismo rango de ELO</p>
                  <p>• Podrás coordinar la partida mediante chat en tiempo real</p>
                  <p>• Sube evidencia del resultado para validar el ganador</p>
                  <p>• Tu ELO se actualizará automáticamente tras cada partida</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Matchmaking;
