/**
 * Core domain types.
 *
 * Deliberate omission: neither `Rating` nor `BurgerVisit` stores a computed
 * score. Scores are always derived from the raw category ratings via
 * `lib/scoring.ts`. Persisting them would let a stored value drift out of sync
 * with the ratings it came from (e.g. if category weights are ever retuned),
 * and the computation is a five-term sum — there is nothing to gain by caching.
 */

/** A category rating: 1.0 to 5.0 in 0.5 increments. */
export type RatingValue = number;

/** The five weighted scoring categories. Keys are stable and persisted. */
export type CategoryKey =
  | "smashTexture"
  | "beefFlavor"
  | "cheeseToppings"
  | "bun"
  | "value";

/** A person who rates burgers. Reusable across visits. */
export interface Reviewer {
  id: string;
  name: string;
  createdAt: string; // ISO timestamp
}

/** One person's scorecard for one burger. */
export interface Rating {
  id: string;
  burgerVisitId: string;
  reviewerId: string;
  smashTexture: RatingValue;
  beefFlavor: RatingValue;
  cheeseToppings: RatingValue;
  bun: RatingValue;
  value: RatingValue;
}

/** A specific burger eaten at a specific place on a specific day. */
export interface BurgerVisit {
  id: string;
  restaurantName: string;
  burgerName: string;
  location: string;
  /** Calendar date of the visit, as `YYYY-MM-DD`. */
  date: string;
  /** Price in dollars, or null if not recorded. */
  price: number | null;
  notes: string;
  /** Key into the photo blob store, or null. See lib/photos.ts. */
  photoId: string | null;
  createdAt: string; // ISO timestamp
}

/** The complete persisted dataset. */
export interface AppData {
  reviewers: Reviewer[];
  visits: BurgerVisit[];
  ratings: Rating[];
}
