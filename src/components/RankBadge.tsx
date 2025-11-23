import { cn } from "@/lib/utils";

interface RankBadgeProps {
  rank: string;
  size?: "sm" | "md" | "lg";
}

const rankColors: Record<string, string> = {
  bronze: "bg-rank-bronze",
  silver: "bg-rank-silver",
  gold: "bg-rank-gold",
  platinum: "bg-rank-platinum",
  diamond: "bg-rank-diamond",
  master: "bg-rank-master",
  grandmaster: "bg-rank-grandmaster",
  elite: "bg-rank-elite",
};

const RankBadge = ({ rank, size = "md" }: RankBadgeProps) => {
  const sizeClasses = {
    sm: "text-xs px-2 py-1",
    md: "text-sm px-3 py-1.5",
    lg: "text-base px-4 py-2",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-lg font-bold uppercase tracking-wide",
        rankColors[rank.toLowerCase()] || "bg-muted",
        sizeClasses[size],
        "text-background shadow-lg"
      )}
    >
      <span>{rank}</span>
    </div>
  );
};

export default RankBadge;
