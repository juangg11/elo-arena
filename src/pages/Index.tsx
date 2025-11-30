import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Trophy, Swords, TrendingUp, Users, Shield, Zap } from "lucide-react";
import heroBg from "@/assets/hero-bg.jpg";
import { supabase } from "@/integrations/supabase/client";

const CompetirButton = ({ navigate }: { navigate: any }) => {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      const session = data?.session;
      const target = "/dashboard";
      if (session?.user) {
        navigate(target);
      } else {
        navigate(`/auth?redirect=${encodeURIComponent(target)}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button size="lg" className="gap-2 text-lg px-8" onClick={handleClick} disabled={loading}>
      <Swords className="h-5 w-5" />
      {loading ? "Comprobando..." : "Competir"}
    </Button>
  );
};

const Index = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      {/* Hero Section */}
      <section className="relative pt-24 pb-20 overflow-hidden">
        <div 
          className="absolute inset-0 opacity-50"
          style={{
            backgroundImage: `url(${heroBg})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/50 via-background/80 to-background" />
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <h1 className="text-5xl md:text-7xl font-bold leading-tight">
              Compite en {" "}
              <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
                Partidas Clasificatorias
              </span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Únete a Hero-Arena para participar en partidos clasificatorios contra otros jugadores de tu mismo nivel,
              escala rangos para volverte el mejor de la ladder.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <CompetirButton navigate={navigate} />
              <Link to="/ladder">
                <Button size="lg" variant="outline" className="gap-2 text-lg px-8">
                  <Trophy className="h-5 w-5" />
                  Rankings
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-gradient-to-b from-background to-secondary/20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Sobre Hero-Arena</h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
              <CardContent className="pt-6 text-center space-y-4">
                <div className="mx-auto w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-bold">Sistema de ELO</h3>
                <p className="text-muted-foreground">
                  Sistema de ELO justo basado en las habilidades de los usuarios.
                </p>
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
              <CardContent className="pt-6 text-center space-y-4">
                <div className="mx-auto w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center">
                  <Trophy className="h-6 w-6 text-accent" />
                </div>
                <h3 className="text-xl font-bold">8 divisiones</h3>
                <p className="text-muted-foreground">
                  Llega desde Novato hasta Héroe. Cada división representa realmente tu nivel y dedicación.
                </p>
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
              <CardContent className="pt-6 text-center space-y-4">
                <div className="mx-auto w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-bold">Ladders regionales</h3>
                <p className="text-muted-foreground">
                  Compite en tu región y escala en los rankings globales o regionales para ser el mejor.
                </p>
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
              <CardContent className="pt-6 text-center space-y-4">
                <div className="mx-auto w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center">
                  <Zap className="h-6 w-6 text-accent" />
                </div>
                <h3 className="text-xl font-bold">Matchmaking instantaneo</h3>
                <p className="text-muted-foreground">
                  Sistema de cola instantaneo encontrando rival en segundos.
                </p>
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
              <CardContent className="pt-6 text-center space-y-4">
                <div className="mx-auto w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-bold">Juego limpio</h3>
                <p className="text-muted-foreground">
                  Validaciones de resultados, reportes e integridad competitiva.
                </p>
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
              <CardContent className="pt-6 text-center space-y-4">
                <div className="mx-auto w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center">
                  <Swords className="h-6 w-6 text-accent" />
                </div>
                <h3 className="text-xl font-bold">Coordinación</h3>
                <p className="text-muted-foreground">
                  Usa el chat para coordinar los partidos en tiempo real con tu oponente.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
      
      <Footer />
    </div>
  );
};

export default Index;
