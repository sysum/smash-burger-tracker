import type { CategoryKey, Rating, RatingValue } from "@/types";

/**
 * The weighted scoring model. Weights are percentages and must total 100 —
 * `TOTAL_WEIGHT` is asserted below so a bad edit fails loudly at import time
 * rather than silently skewing every score in the app.
 *
 * This array is the single source of truth: the rating UI, the category
 * averages on the detail screen, and the score maths all iterate over it.
 * Adding or reweighting a category means editing here and nowhere else.
 */
export const CATEGORIES = [
  { key: "smashTexture", label: "Smash / Texture", short: "Smash", weight: 35 },
  { key: "beefFlavor", label: "Beef Flavor", short: "Beef", weight: 25 },
  { key: "cheeseToppings", label: "Cheese & Toppings", short: "Cheese", weight: 20 },
  { key: "bun", label: "Bun", short: "Bun", weight: 15 },
  { key: "value", label: "Value", short: "Value", weight: 5 },
] as const satisfies readonly {
  key: CategoryKey;
  label: string;
  short: string;
  weight: number;
}[];

export const TOTAL_WEIGHT = CATEGORIES.reduce((sum, c) => sum + c.weight, 0);

if (TOTAL_WEIGHT !== 100) {
  throw new Error(
    `Scoring weights must total 100, got ${TOTAL_WEIGHT}. Check CATEGORIES in lib/scoring.ts.`,
  );
}

/** Lowest and highest allowed rating, and the increment between them. */
export const MIN_RATING = 1;
export const MAX_RATING = 5;
export const RATING_STEP = 0.5;

/** Every selectable rating: [1, 1.5, 2, ... 5]. */
export const RATING_SCALE: RatingValue[] = Array.from(
  { length: (MAX_RATING - MIN_RATING) / RATING_STEP + 1 },
  (_, i) => MIN_RATING + i * RATING_STEP,
);

/** The default a fresh scorecard starts on — the midpoint of the scale. */
export const DEFAULT_RATING: RatingValue = 3;

/**
 * Round to `decimals` places, half away from zero.
 *
 * The epsilon nudge matters. Binary floating point stores 8.175 as
 * 8.17499999999999982..., so a naive `Math.round(8.175 * 10) / 10` yields 8.1
 * where every human expects 8.2. Nudging by one ULP-ish epsilon before rounding
 * pushes such values back onto the intended side of the boundary.
 */
export function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/** Clamp to the valid range and snap to the nearest half point. */
export function normalizeRating(value: number): RatingValue {
  const snapped = Math.round(value / RATING_STEP) * RATING_STEP;
  return Math.min(MAX_RATING, Math.max(MIN_RATING, snapped));
}

/** The five category values of a rating, without the record's identity fields. */
export type CategoryScores = Record<CategoryKey, RatingValue>;

/**
 * Convert one person's scorecard to a 0-100 weighted score.
 *
 *   score = Σ (rating × weight) / 5
 *
 * Note the multiply-before-divide. The equivalent-looking
 * `(rating / 5) × weight` is worse in floating point: 4 / 5 is inexact in
 * binary, so it gives 28.000000000000004 for the first term and the canonical
 * worked example lands on 76.50000000000001 instead of 76.5. Multiplying first
 * keeps every intermediate exact for half-point inputs and integer weights.
 */
export function weightedScore(scores: CategoryScores): number {
  const total = CATEGORIES.reduce(
    (sum, { key, weight }) => sum + (scores[key] * weight) / MAX_RATING,
    0,
  );
  return roundTo(total, 2);
}

/** The overall 0-100 score for a burger: the mean of its reviewers' scores. */
export function overallScore(ratings: CategoryScores[]): number | null {
  if (ratings.length === 0) return null;
  const sum = ratings.reduce((acc, r) => acc + weightedScore(r), 0);
  return roundTo(sum / ratings.length, 2);
}

/** Present a 0-100 score on the 10-point scale, to one decimal place. */
export function toTenPoint(score100: number): number {
  return roundTo(score100 / 10, 1);
}

/** Format a 0-100 score for display as "8.2". Always one decimal place. */
export function formatTenPoint(score100: number): string {
  return toTenPoint(score100).toFixed(1);
}

/**
 * Mean rating per category across reviewers, on the original 1-5 scale.
 * Used for the category breakdown on the burger detail screen.
 */
export function averageCategoryScores(
  ratings: CategoryScores[],
): CategoryScores | null {
  if (ratings.length === 0) return null;
  const out = {} as CategoryScores;
  for (const { key } of CATEGORIES) {
    const sum = ratings.reduce((acc, r) => acc + r[key], 0);
    out[key] = roundTo(sum / ratings.length, 2);
  }
  return out;
}

/** Pull just the category values out of a persisted Rating record. */
export function toCategoryScores(rating: Rating): CategoryScores {
  return {
    smashTexture: rating.smashTexture,
    beefFlavor: rating.beefFlavor,
    cheeseToppings: rating.cheeseToppings,
    bun: rating.bun,
    value: rating.value,
  };
}

/** A blank scorecard, every category at the default. */
export function emptyCategoryScores(): CategoryScores {
  const out = {} as CategoryScores;
  for (const { key } of CATEGORIES) out[key] = DEFAULT_RATING;
  return out;
}
