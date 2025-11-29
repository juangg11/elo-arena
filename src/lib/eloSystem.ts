/**
 * ELO System - Similar to League of Legends LP System
 * 
 * Features:
 * - Base points calculated from ELO difference
 * - Win/Loss streaks affect points (up to 5 streak bonus)
 * - Higher ELO = harder to climb
 * - Upset protection: losing to lower ELO = big penalty, winning = small gain
 * - Max gain/loss capped at 30 (except extreme cases)
 */

// Rank thresholds
export const RANK_THRESHOLDS = [
  { name: 'novato', minElo: 0, maxElo: 499 },
  { name: 'aspirante', minElo: 500, maxElo: 799 },
  { name: 'promesa', minElo: 800, maxElo: 1199 },
  { name: 'relampago', minElo: 1200, maxElo: 1399 },
  { name: 'tormenta', minElo: 1400, maxElo: 1599 },
  { name: 'supernova', minElo: 1600, maxElo: 1799 },
  { name: 'inazuma', minElo: 1800, maxElo: 2499 },
  { name: 'heroe', minElo: 2500, maxElo: Infinity },
];

// Base K-factor (how much ELO can change per game)
const BASE_K = 20;

// Streak multipliers
const STREAK_MULTIPLIERS = [1.0, 1.0, 1.1, 1.15, 1.2, 1.25]; // 0, 1, 2, 3, 4, 5+ streak

// ELO tier modifiers (higher ELO = harder to gain)
const ELO_TIER_MODIFIERS: { threshold: number; modifier: number }[] = [
  { threshold: 500, modifier: 1.2 },   // Novato: easier to climb
  { threshold: 800, modifier: 1.1 },   // Aspirante: slightly easier
  { threshold: 1200, modifier: 1.0 },  // Promesa: normal
  { threshold: 1400, modifier: 0.95 }, // Relampago: slightly harder
  { threshold: 1600, modifier: 0.9 },  // Tormenta: harder
  { threshold: 1800, modifier: 0.85 }, // Supernova: much harder
  { threshold: 2500, modifier: 0.8 },  // Inazuma: very hard
  { threshold: Infinity, modifier: 0.75 }, // Heroe: extremely hard
];

/**
 * Get the rank name for a given ELO
 */
export function getRankFromElo(elo: number): string {
  for (const rank of RANK_THRESHOLDS) {
    if (elo >= rank.minElo && elo <= rank.maxElo) {
      return rank.name;
    }
  }
  return 'novato';
}

/**
 * Get the ELO tier modifier (higher ELO = harder to gain points)
 */
function getEloTierModifier(elo: number): number {
  for (const tier of ELO_TIER_MODIFIERS) {
    if (elo < tier.threshold) {
      return tier.modifier;
    }
  }
  return 0.75;
}

/**
 * Get streak multiplier
 */
function getStreakMultiplier(streak: number): number {
  const index = Math.min(Math.abs(streak), STREAK_MULTIPLIERS.length - 1);
  return STREAK_MULTIPLIERS[index];
}

/**
 * Calculate expected win probability using ELO formula
 */
function getExpectedScore(playerElo: number, opponentElo: number): number {
  return 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400));
}

/**
 * Calculate ELO change for a match
 * 
 * @param winnerElo - ELO of the winner
 * @param loserElo - ELO of the loser
 * @param winnerStreak - Win streak of winner (positive = wins, negative = losses before this game)
 * @param loserStreak - Loss streak of loser (positive = wins before this game, negative = losses)
 * @returns Object with points gained/lost and new ELOs
 */
export function calculateEloChange(
  winnerElo: number,
  loserElo: number,
  winnerStreak: number = 0,
  loserStreak: number = 0
): {
  winnerGain: number;
  loserLoss: number;
  newWinnerElo: number;
  newLoserElo: number;
  isUpset: boolean;
  explanation: string;
} {
  const eloDiff = winnerElo - loserElo;
  const isUpset = eloDiff < -100; // Winner had significantly lower ELO
  const isFavoriteWin = eloDiff > 100; // Winner had significantly higher ELO
  
  // Expected scores
  const expectedWinner = getExpectedScore(winnerElo, loserElo);
  const expectedLoser = 1 - expectedWinner;
  
  // Base change calculation
  let winnerBaseChange = BASE_K * (1 - expectedWinner);
  let loserBaseChange = BASE_K * expectedLoser;
  
  // Apply ELO tier modifiers
  const winnerTierMod = getEloTierModifier(winnerElo);
  const loserTierMod = getEloTierModifier(loserElo);
  
  winnerBaseChange *= winnerTierMod;
  loserBaseChange *= loserTierMod;
  
  // Apply streak multipliers
  // Winner: if they were on a win streak, bonus. If breaking a loss streak, smaller bonus
  const winnerStreakMod = winnerStreak >= 0 
    ? getStreakMultiplier(winnerStreak + 1) // Continuing/starting win streak
    : 1.0; // Breaking loss streak - normal points
  
  // Loser: if they were on a loss streak, lose more. If breaking a win streak, normal loss
  const loserStreakMod = loserStreak <= 0
    ? getStreakMultiplier(Math.abs(loserStreak) + 1) // Continuing/starting loss streak
    : 1.0; // Breaking win streak - normal loss
  
  winnerBaseChange *= winnerStreakMod;
  loserBaseChange *= loserStreakMod;
  
  // Upset adjustments
  if (isUpset) {
    // Underdog wins - they get bonus, favorite loses more
    winnerBaseChange *= 1.3;
    loserBaseChange *= 1.4;
  } else if (isFavoriteWin) {
    // Favorite wins - they get less, underdog loses less (protection)
    winnerBaseChange *= 0.7;
    loserBaseChange *= 0.6; // Underdog protection
  }
  
  // Round and cap the values
  let winnerGain = Math.round(winnerBaseChange);
  let loserLoss = Math.round(loserBaseChange);
  
  // Minimum changes
  winnerGain = Math.max(winnerGain, 5); // Minimum 5 points for winning
  loserLoss = Math.max(loserLoss, 5); // Minimum 5 points lost
  
  // Maximum caps (30 normally, 35 for extreme cases)
  const maxNormal = 30;
  const maxExtreme = 35;
  
  if (isUpset && Math.abs(eloDiff) > 300) {
    // Extreme upset - allow up to 35
    winnerGain = Math.min(winnerGain, maxExtreme);
    loserLoss = Math.min(loserLoss, maxExtreme);
  } else {
    winnerGain = Math.min(winnerGain, maxNormal);
    loserLoss = Math.min(loserLoss, maxNormal);
  }
  
  // Calculate new ELOs
  const newWinnerElo = winnerElo + winnerGain;
  const newLoserElo = Math.max(0, loserElo - loserLoss); // Can't go below 0
  
  // Generate explanation
  let explanation = '';
  if (isUpset) {
    explanation = `¡Sorpresa! +${winnerGain} (bonus por victoria inesperada)`;
  } else if (isFavoriteWin) {
    explanation = `Victoria esperada: +${winnerGain}`;
  } else {
    explanation = `Partido equilibrado: +${winnerGain}`;
  }
  
  return {
    winnerGain,
    loserLoss,
    newWinnerElo,
    newLoserElo,
    isUpset,
    explanation
  };
}

/**
 * Check if a player has changed rank after ELO update
 */
export function checkRankChange(
  oldElo: number,
  newElo: number
): {
  changed: boolean;
  promoted: boolean;
  demoted: boolean;
  oldRank: string;
  newRank: string;
} {
  const oldRank = getRankFromElo(oldElo);
  const newRank = getRankFromElo(newElo);
  const changed = oldRank !== newRank;
  
  // Find rank indices
  const oldIndex = RANK_THRESHOLDS.findIndex(r => r.name === oldRank);
  const newIndex = RANK_THRESHOLDS.findIndex(r => r.name === newRank);
  
  return {
    changed,
    promoted: newIndex > oldIndex,
    demoted: newIndex < oldIndex,
    oldRank,
    newRank
  };
}

/**
 * Calculate match preview - shows expected points before match
 */
export function calculateMatchPreview(
  player1Elo: number,
  player2Elo: number,
  player1Streak: number = 0,
  player2Streak: number = 0
): {
  player1WinGain: number;
  player1LoseLoss: number;
  player2WinGain: number;
  player2LoseLoss: number;
  player1WinChance: number;
  player2WinChance: number;
} {
  // If player 1 wins
  const p1Wins = calculateEloChange(player1Elo, player2Elo, player1Streak, player2Streak);
  
  // If player 2 wins
  const p2Wins = calculateEloChange(player2Elo, player1Elo, player2Streak, player1Streak);
  
  const player1WinChance = Math.round(getExpectedScore(player1Elo, player2Elo) * 100);
  const player2WinChance = 100 - player1WinChance;
  
  return {
    player1WinGain: p1Wins.winnerGain,
    player1LoseLoss: p2Wins.loserLoss,
    player2WinGain: p2Wins.winnerGain,
    player2LoseLoss: p1Wins.loserLoss,
    player1WinChance,
    player2WinChance
  };
}

