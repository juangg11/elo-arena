import { cn } from "@/lib/utils";

interface RankBadgeProps {
  rank: string;
  size?: "sm" | "md" | "lg";
}

const rankColors: Record<string, string> = {
  novato: "bg-rank-bronze",
  aspirante: "bg-rank-silver",
  promesa: "bg-rank-gold",
  relampago: "bg-rank-platinum",
  tormenta: "bg-rank-diamond",
  supernova: "bg-rank-master",
  inazuma: "bg-rank-grandmaster",
  heroe: "bg-rank-elite",
};

const displayNames: Record<string, string> = {
  novato: "Novato",
  aspirante: "Aspirante",
  promesa: "Promesa",
  relampago: "Relámpago",
  tormenta: "Tormenta",
  supernova: "Supernova",
  inazuma: "Inazuma",
  heroe: "Héroe",
};

// Aliases to accept different incoming rank names (english/variants) and map them to internal keys
const rankAliases: Record<string, string> = {
  hero: "heroe",
  héroe: "heroe",
  heroe: "heroe",
  bronzE: "novato",
  bronze: "novato",
  plata: "aspirante",
  silver: "aspirante",
  gold: "promesa",
  platinum: "relampago",
  diamond: "tormenta",
  master: "supernova",
  grandmaster: "inazuma",
  elite: "heroe",
};

const RankBadge = ({ rank, size = "md" }: RankBadgeProps) => {
  const sizeClasses = {
    sm: "text-xs px-2 py-1",
    md: "text-sm px-3 py-1.5",
    lg: "text-base px-4 py-2",
  };

  // Provide a consistent fixed width for badges on non-sm sizes to ensure symmetry
  const widthClass = size === "sm" ? "" : "w-[7.5rem] justify-center";
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-lg font-bold uppercase tracking-wide",
        rankColors[rank.toLowerCase()] || "bg-muted",
        sizeClasses[size],
        widthClass,
        "text-background shadow-lg text-center"
      )}
    >
      {(() => {
        const raw = rank.toLowerCase();
        const normalized = rankAliases[raw] ?? raw;
        const display = displayNames[normalized] ?? rank;
        return <span>{display}</span>;
      })()}
    </div>
  );
};

export default RankBadge;
