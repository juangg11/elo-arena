import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Navbar from "@/components/Navbar";
import { Trophy, Swords, TrendingUp, Users, Shield, Zap } from "lucide-react";
import heroBg from "@/assets/hero-bg.jpg";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      {/* Hero Section */}
      <section className="relative pt-24 pb-20 overflow-hidden">
        <div 
          className="absolute inset-0 opacity-20"
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
              Compete in{" "}
              <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
                Ranked Matches
              </span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Join the competitive arena. Match against players of your skill level, 
              climb the ranks, and prove you're the best.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/auth">
                <Button size="lg" className="gap-2 text-lg px-8">
                  <Swords className="h-5 w-5" />
                  Start Competing
                </Button>
              </Link>
              <Link to="/ladder">
                <Button size="lg" variant="outline" className="gap-2 text-lg px-8">
                  <Trophy className="h-5 w-5" />
                  View Rankings
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
            <h2 className="text-4xl font-bold mb-4">Why MatchArena?</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Experience competitive gaming with a fair and transparent ranking system
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
              <CardContent className="pt-6 text-center space-y-4">
                <div className="mx-auto w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-bold">ELO Rating System</h3>
                <p className="text-muted-foreground">
                  Fair matchmaking based on proven ELO algorithms. Face opponents at your skill level.
                </p>
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
              <CardContent className="pt-6 text-center space-y-4">
                <div className="mx-auto w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center">
                  <Trophy className="h-6 w-6 text-accent" />
                </div>
                <h3 className="text-xl font-bold">8 Rank Divisions</h3>
                <p className="text-muted-foreground">
                  Climb from Bronze to Elite. Each division represents your skill and dedication.
                </p>
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
              <CardContent className="pt-6 text-center space-y-4">
                <div className="mx-auto w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-bold">Regional Ladders</h3>
                <p className="text-muted-foreground">
                  Compete in your region and climb global rankings. Multiple leaderboards to conquer.
                </p>
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
              <CardContent className="pt-6 text-center space-y-4">
                <div className="mx-auto w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center">
                  <Zap className="h-6 w-6 text-accent" />
                </div>
                <h3 className="text-xl font-bold">Instant Matchmaking</h3>
                <p className="text-muted-foreground">
                  Quick queue system finds you matches in seconds. Get into the action fast.
                </p>
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
              <CardContent className="pt-6 text-center space-y-4">
                <div className="mx-auto w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-bold">Fair Play System</h3>
                <p className="text-muted-foreground">
                  Evidence-based result validation ensures competitive integrity.
                </p>
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
              <CardContent className="pt-6 text-center space-y-4">
                <div className="mx-auto w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center">
                  <Swords className="h-6 w-6 text-accent" />
                </div>
                <h3 className="text-xl font-bold">Live Coordination</h3>
                <p className="text-muted-foreground">
                  Built-in chat to coordinate matches with your opponents in real-time.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-b from-secondary/20 to-background">
        <div className="container mx-auto px-4 text-center">
          <div className="max-w-3xl mx-auto space-y-8">
            <h2 className="text-4xl md:text-5xl font-bold">
              Ready to Prove Your Skill?
            </h2>
            <p className="text-xl text-muted-foreground">
              Join thousands of competitive players. Start your journey to the top today.
            </p>
            <Link to="/auth">
              <Button size="lg" className="gap-2 text-lg px-8">
                <Trophy className="h-5 w-5" />
                Join the Arena
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Index;
