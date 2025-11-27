import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { User } from "lucide-react";

const Navbar = () => {
  const navigate = useNavigate();
  const [isLogged, setIsLogged] = useState<boolean | null>(null);

  useEffect(() => {
    const checkUser = async () => {
      const { data } = await supabase.auth.getUser();
      setIsLogged(!!data.user);
    };

    checkUser();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLogged(!!session?.user);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsLogged(false);
    navigate("/auth");
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="container mx-auto px-4">
        <div className="h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group flex-shrink-0">
            <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
              <svg className="h-6 w-6 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="9.5" />
                <path d="M12 2.5 L9 8 L3 9 L7 13.5 L5.5 19.5 L12 16 L18.5 19.5 L17 13.5 L21 9 L15 8 Z" strokeWidth="1" />
                <path d="M12 2.5v6.5M9 8L3 9M3 9l4 4.5M7 13.5l-1.5 6M5.5 19.5L12 16M12 16l6.5 3.5M18.5 19.5L17 13.5M17 13.5l4-4.5M21 9l-6-1M15 8l-3-5.5" strokeWidth="0.5" opacity="0.6" />
              </svg>
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent whitespace-nowrap">
              Hero-Arena
            </span>
          </Link>

          <div className="flex items-center gap-3 flex-shrink-0" style={{ minWidth: '180px', justifyContent: 'flex-end' }}>
            {isLogged === null ? (
              <div className="w-[180px]" />
            ) : isLogged ? (
              <>
                <Link to="/profile">
                  <Button variant="ghost" size="icon">
                    <User className="h-5 w-5" />
                  </Button>
                </Link>
                <Button variant="destructive" onClick={handleLogout}>
                  Logout
                </Button>
              </>
            ) : (
              <Link to="/auth">
                <Button variant="outline">
                  Login
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
