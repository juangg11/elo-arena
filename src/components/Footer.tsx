import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Users } from "lucide-react";

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

const Footer = () => {
  const [version, setVersion] = useState("1.0.0");
  const { toast } = useToast();

  useEffect(() => {
    // Load version from file
    fetch("/VERSION.txt")
      .then((res) => res.text())
      .then((text) => {
        const v = text.trim();
        if (v) setVersion(v);
      })
      .catch(() => {
        // Fallback to package.json version if VERSION.txt doesn't exist
        setVersion("1.0.0");
      });
  }, []);

  const copyDiscordUsername = async () => {
    try {
      await navigator.clipboard.writeText("juangg__");
      toast({
        title: "Copiado",
        description: "Usuario de Discord copiado al portapapeles",
      });
    } catch (err) {
      console.error("Error al copiar:", err);
    }
  };

  return (
    <footer className="border-t border-border bg-background/80 backdrop-blur-md">
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 text-sm text-muted-foreground">
          <span>Hecho por Sora</span>
          
          <a
            href="https://discord.gg/9tX7CwcUrw"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 hover:text-foreground transition-colors cursor-pointer"
            title="Unirse a la comunidad de Discord"
          >
            <Users className="h-4 w-4" />
            <span>Comunidad</span>
          </a>
          
          <span className="text-muted-foreground/60">•</span>
          
          <button
            onClick={copyDiscordUsername}
            className="flex items-center gap-2 hover:text-foreground transition-colors cursor-pointer"
            title="Copiar usuario de Discord"
          >
            <DiscordIcon />
            <span>juangg__</span>
          </button>
          
          <span className="text-muted-foreground/60">•</span>
          
          <span>V {version}</span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

