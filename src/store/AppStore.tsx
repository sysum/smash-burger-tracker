import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { EMPTY_DATA, repository } from "@/lib/repository";
import * as mutations from "@/lib/mutations";
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

  addReviewer: (name: string) => Promise<Reviewer>;
  renameReviewer: (id: string, name: string) => Promise<void>;
  deleteReviewer: (id: string) => Promise<void>;

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

  useEffect(() => {
    let cancelled = false;
    repository.load().then((loaded) => {
      if (cancelled) return;
      setData(loaded);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Persist one change, then reflect it in memory.
   *
   * The write is awaited and its failure propagates to the caller, so a screen
   * can tell the user their burger did not save. The previous shape — update
   * state, let an effect write in the background — could not: by the time the
   * write failed the screen had already navigated away, and the only trace was
   * a console error behind a burger that looked saved and wasn't.
   *
   * Storage first, then state, so the two can never disagree. Against
   * IndexedDB the wait is imperceptible. When a remote backend lands this is
   * the seam to revisit: applying to state first and rolling back on failure
   * would hide the network round-trip, at the cost of having to undo a change
   * the user can already see.
   */
  const mutate = useCallback(
    async (persist: () => Promise<void>, apply: (data: AppData) => AppData) => {
      await persist();
      setData(apply);
    },
    [],
  );

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

  const addReviewer = useCallback(
    async (name: string): Promise<Reviewer> => {
      const reviewer: Reviewer = {
        id: newId(),
        name: name.trim(),
        createdAt: new Date().toISOString(),
      };
      await mutate(
        () => repository.addReviewer(reviewer),
        (data) => mutations.addReviewer(data, reviewer),
      );
      return reviewer;
    },
    [mutate],
  );

  const renameReviewer = useCallback(
    async (id: string, name: string) => {
      // A blank rename is the user backing out of the field, not a request to
      // erase the name. Caught here so it never reaches storage as a write.
      if (!name.trim()) return;
      await mutate(
        () => repository.renameReviewer(id, name),
        (data) => mutations.renameReviewer(data, id, name),
      );
    },
    [mutate],
  );

  const deleteReviewer = useCallback(
    async (id: string) => {
      await mutate(
        () => repository.deleteReviewer(id),
        (data) => mutations.deleteReviewer(data, id),
      );
    },
    [mutate],
  );

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
      await mutate(
        () => repository.addVisit(visit, ratings),
        (data) => mutations.addVisit(data, visit, ratings),
      );
      return visitId;
    },
    [mutate],
  );

  const deleteVisit = useCallback(
    async (visitId: string) => {
      // The photo blob goes too, but that is the repository's business now —
      // it is the side that knows blobs exist.
      await mutate(
        () => repository.deleteVisit(visitId),
        (data) => mutations.deleteVisit(data, visitId),
      );
    },
    [mutate],
  );

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
