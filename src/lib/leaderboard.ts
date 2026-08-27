import { overallScore, toCategoryScores } from "@/lib/scoring";
import type { BurgerVisit, Rating } from "@/types";

/** A burger plus everything derived from its ratings. */
export interface ScoredVisit {
  visit: BurgerVisit;
  ratings: Rating[];
  /** 0-100, or null when nobody has rated this burger yet. */
  score: number | null;
  reviewerCount: number;
}

export type SortKey = "highest" | "lowest" | "recent" | "oldest";

export const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "highest", label: "Highest rated" },
  { key: "lowest", label: "Lowest rated" },
  { key: "recent", label: "Most recent" },
  { key: "oldest", label: "Oldest" },
];

/** Attach ratings and a computed score to every visit. */
export function scoreVisits(visits: BurgerVisit[], ratings: Rating[]): ScoredVisit[] {
  const byVisit = new Map<string, Rating[]>();
  for (const rating of ratings) {
    const list = byVisit.get(rating.burgerVisitId);
    if (list) list.push(rating);
    else byVisit.set(rating.burgerVisitId, [rating]);
  }

  return visits.map((visit) => {
    const visitRatings = byVisit.get(visit.id) ?? [];
    return {
      visit,
      ratings: visitRatings,
      score: overallScore(visitRatings.map(toCategoryScores)),
      reviewerCount: visitRatings.length,
    };
  });
}

/**
 * Newest first. `date` is the day of the visit and is what the user sees, but
 * two burgers eaten the same day need a stable tiebreak, so `createdAt` (which
 * is unique per record) decides within a day.
 */
function newestFirst(a: ScoredVisit, b: ScoredVisit): number {
  if (a.visit.date !== b.visit.date) return b.visit.date.localeCompare(a.visit.date);
  return b.visit.createdAt.localeCompare(a.visit.createdAt);
}

/**
 * Order the leaderboard. Returns a new array; the input is not mutated.
 *
 * Unrated burgers have no position in a rated ranking, so under both score
 * sorts they collect at the bottom rather than being treated as a 0 (which
 * would make them the "worst") or as a perfect score (the "best"). Within the
 * unrated group, and on any score tie, newest wins so the order is stable and
 * predictable rather than dependent on insertion order.
 */
export function sortScoredVisits(entries: ScoredVisit[], sort: SortKey): ScoredVisit[] {
  return [...entries].sort((a, b) => {
    switch (sort) {
      case "recent":
        return newestFirst(a, b);
      case "oldest":
        return -newestFirst(a, b);
      case "highest":
      case "lowest": {
        if (a.score === null && b.score === null) return newestFirst(a, b);
        if (a.score === null) return 1;
        if (b.score === null) return -1;
        if (a.score === b.score) return newestFirst(a, b);
        return sort === "highest" ? b.score - a.score : a.score - b.score;
      }
    }
  });
}
