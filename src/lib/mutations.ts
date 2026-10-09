/**
 * Every change that can be made to the dataset, as pure transforms.
 *
 * These were inlined in `AppStore` as `setData` callbacks. They live here now
 * because two separate consumers need to agree on them exactly: the React
 * store, which applies a change to the in-memory copy, and `Repository`, which
 * applies the same change to storage. A rule that lived in only one of those —
 * "deleting a reviewer also deletes their scorecards", say — would hold in
 * memory and quietly not hold on disk, and the divergence would only show up
 * after a reload.
 *
 * Pure and React-free for the same reason `scoring.ts` is: it makes them
 * exhaustively testable without a DOM or an IndexedDB.
 *
 * Each returns a new `AppData`; none mutates its input.
 */
import type { AppData, BurgerVisit, Rating, Reviewer } from "@/types";

export function addReviewer(data: AppData, reviewer: Reviewer): AppData {
  return { ...data, reviewers: [...data.reviewers, reviewer] };
}

export function renameReviewer(data: AppData, id: string, name: string): AppData {
  const trimmed = name.trim();
  if (!trimmed) return data;
  return {
    ...data,
    reviewers: data.reviewers.map((r) => (r.id === id ? { ...r, name: trimmed } : r)),
  };
}

export function deleteReviewer(data: AppData, id: string): AppData {
  // Their past scorecards go too. Leaving orphaned ratings behind would keep a
  // deleted person's numbers silently folded into every burger average they
  // ever contributed to, with no way to see whose they were.
  return {
    ...data,
    reviewers: data.reviewers.filter((r) => r.id !== id),
    ratings: data.ratings.filter((rating) => rating.reviewerId !== id),
  };
}

export function addVisit(data: AppData, visit: BurgerVisit, ratings: Rating[]): AppData {
  return {
    ...data,
    visits: [...data.visits, visit],
    ratings: [...data.ratings, ...ratings],
  };
}

export function deleteVisit(data: AppData, visitId: string): AppData {
  return {
    ...data,
    visits: data.visits.filter((v) => v.id !== visitId),
    ratings: data.ratings.filter((r) => r.burgerVisitId !== visitId),
  };
}

/** The photo blob a visit owns, so callers can clean it up. Null if none. */
export function photoIdForVisit(data: AppData, visitId: string): string | null {
  return data.visits.find((v) => v.id === visitId)?.photoId ?? null;
}
