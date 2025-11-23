import Navbar from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const Matchmaking = () => {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const getSession = async () => {
      const { data } = await supabase.auth.getSession();
      setUser(data?.session?.user ?? null);
    };
    getSession();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 pt-24 pb-12">
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-center">Matchmaking</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              {user ? (
                <p className="text-muted-foreground">Buscando partida para <strong>{user?.email}</strong>...</p>
              ) : (
                <p className="text-muted-foreground">No hay sesión activa. Por favor inicia sesión.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Matchmaking;
