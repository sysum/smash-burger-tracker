import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { EMPTY_DATA, repository } from "@/lib/repository";
import { newId } from "@/lib/id";
import { scoreVisits, sortScoredVisits, type ScoredVisit, type SortKey } from "@/lib/leaderboard";
import type { CategoryScores } from "@/lib/scoring";
import type { AppData, BurgerVisit, Rating, Reviewer } from "@/types";

export { SORT_OPTIONS, type ScoredVisit, type SortKey } from "@/lib/leaderboard";

/** Fields the user fills in on the add-burger form. */
export type VisitDraft = Omit<BurgerVisit, "id" | "createdAt">;

interface AppStoreValue {
  ready: boolean;
  reviewers: Reviewer[];
  visits: BurgerVisit[];
  ratings: Rating[];

  /** Burgers with scores attached, sorted by `sort`. Unrated burgers sort last. */
  leaderboard: (sort: SortKey) => ScoredVisit[];
  getScoredVisit: (visitId: string) => ScoredVisit | null;
  getReviewer: (reviewerId: string) => Reviewer | null;

  addReviewer: (name: string) => Reviewer;
  renameReviewer: (id: string, name: string) => void;
  deleteReviewer: (id: string) => void;

  /** Create a burger and its reviewers' scorecards in one atomic write. */
  addVisit: (
    draft: VisitDraft,
    scorecards: { reviewerId: string; scores: CategoryScores }[],
  ) => Promise<string>;
  deleteVisit: (visitId: string) => Promise<void>;
}

const AppStoreContext = createContext<AppStoreValue | null>(null);

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(EMPTY_DATA);
  const [ready, setReady] = useState(false);

  // Guards the persist effect below so the initial hydration doesn't
  // immediately write the empty dataset back over real stored data.
  const hydrated = useRef(false);

  useEffect(() => {
    let cancelled = false;
    repository.load().then((loaded) => {
      if (cancelled) return;
      setData(loaded);
      hydrated.current = true;
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    repository.save(data).catch((error) => {
      console.error("Failed to persist data", error);
    });
  }, [data]);

  const scoredByVisit = useMemo(() => {
    const entries = scoreVisits(data.visits, data.ratings);
    return new Map(entries.map((entry) => [entry.visit.id, entry]));
  }, [data.visits, data.ratings]);

  const leaderboard = useCallback(
    (sort: SortKey) => sortScoredVisits([...scoredByVisit.values()], sort),
    [scoredByVisit],
  );

  const getScoredVisit = useCallback(
    (visitId: string) => scoredByVisit.get(visitId) ?? null,
    [scoredByVisit],
  );

  const reviewersById = useMemo(
    () => new Map(data.reviewers.map((r) => [r.id, r])),
    [data.reviewers],
  );

  const getReviewer = useCallback(
    (reviewerId: string) => reviewersById.get(reviewerId) ?? null,
    [reviewersById],
  );

  const addReviewer = useCallback((name: string): Reviewer => {
    const reviewer: Reviewer = {
      id: newId(),
      name: name.trim(),
      createdAt: new Date().toISOString(),
    };
    setData((prev) => ({ ...prev, reviewers: [...prev.reviewers, reviewer] }));
    return reviewer;
  }, []);

  const renameReviewer = useCallback((id: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setData((prev) => ({
      ...prev,
      reviewers: prev.reviewers.map((r) => (r.id === id ? { ...r, name: trimmed } : r)),
    }));
  }, []);

  const deleteReviewer = useCallback((id: string) => {
    // Their past scorecards go too. Leaving orphaned ratings behind would keep
    // a deleted person's numbers silently folded into every burger average
    // they ever contributed to, with no way to see whose they were.
    setData((prev) => ({
      ...prev,
      reviewers: prev.reviewers.filter((r) => r.id !== id),
      ratings: prev.ratings.filter((rating) => rating.reviewerId !== id),
    }));
  }, []);

  const addVisit = useCallback(
    async (
      draft: VisitDraft,
      scorecards: { reviewerId: string; scores: CategoryScores }[],
    ): Promise<string> => {
      const visitId = newId();
      const visit: BurgerVisit = {
        ...draft,
        id: visitId,
        createdAt: new Date().toISOString(),
      };
      const ratings: Rating[] = scorecards.map(({ reviewerId, scores }) => ({
        id: newId(),
        burgerVisitId: visitId,
        reviewerId,
        ...scores,
      }));
      setData((prev) => ({
        ...prev,
        visits: [...prev.visits, visit],
        ratings: [...prev.ratings, ...ratings],
      }));
      return visitId;
    },
    [],
  );

  const deleteVisit = useCallback(async (visitId: string) => {
    const photoId = data.visits.find((v) => v.id === visitId)?.photoId ?? null;
    setData((prev) => ({
      ...prev,
      visits: prev.visits.filter((v) => v.id !== visitId),
      ratings: prev.ratings.filter((r) => r.burgerVisitId !== visitId),
    }));
    if (photoId) await repository.deletePhoto(photoId);
  }, [data.visits]);

  const value = useMemo(
    (): AppStoreValue => ({
      ready,
      reviewers: data.reviewers,
      visits: data.visits,
      ratings: data.ratings,
      leaderboard,
      getScoredVisit,
      getReviewer,
      addReviewer,
      renameReviewer,
      deleteReviewer,
      addVisit,
      deleteVisit,
    }),
    [
      ready,
      data.reviewers,
      data.visits,
      data.ratings,
      leaderboard,
      getScoredVisit,
      getReviewer,
      addReviewer,
      renameReviewer,
      deleteReviewer,
      addVisit,
      deleteVisit,
    ],
  );

  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>;
}

export function useAppStore(): AppStoreValue {
  const context = useContext(AppStoreContext);
  if (!context) throw new Error("useAppStore must be used inside AppStoreProvider");
  return context;
}
