import { del, get, set, update } from "idb-keyval";
import * as mutations from "@/lib/mutations";
import { isSupabaseConfigured } from "@/lib/supabase";
import { SupabaseRepository } from "@/lib/supabaseRepository";
import type { AppData, BurgerVisit, Rating, Reviewer } from "@/types";

/**
 * The single persistence boundary for the whole app.
 *
 * Every read and write of user data goes through this interface. Nothing above
 * it — no screen, no component, no store action — knows or cares that the
 * current implementation is IndexedDB. That is deliberate: when this app is
 * wrapped with Capacitor for the App Store, or gains cross-device sync, the
 * swap is a new implementation of `Repository` and a one-line change to
 * `repository` below. No screen changes.
 *
 * The interface is one method per user-visible change rather than a single
 * `save(wholeDataset)`. Both shapes work against local storage, but only this
 * one works against a network backend: a whole-dataset write means rewriting
 * every row on every edit, and — worse — two devices editing the same data
 * overwrite each other wholesale, because neither write says what it changed.
 * Naming the individual change keeps a remote implementation to one INSERT or
 * one DELETE, and keeps concurrent edits from clobbering each other.
 *
 * Why IndexedDB rather than localStorage: localStorage caps around 5MB and
 * stores strings only, so burger photos would either blow the quota or need
 * base64 encoding (a 33% size penalty on top). IndexedDB stores Blobs natively
 * and has a far larger quota. It also maps cleanly onto Capacitor's SQLite and
 * Filesystem plugins later.
 */
export interface Repository {
  /** Read the whole dataset. Returns empty collections on first run. */
  load(): Promise<AppData>;

  addReviewer(reviewer: Reviewer): Promise<void>;
  renameReviewer(id: string, name: string): Promise<void>;
  /** Deletes the reviewer and every scorecard they wrote. */
  deleteReviewer(id: string): Promise<void>;

  /** Create a burger and its reviewers' scorecards in one atomic write. */
  addVisit(visit: BurgerVisit, ratings: Rating[]): Promise<void>;
  /** Deletes the burger, its scorecards, and its photo. */
  deleteVisit(visitId: string): Promise<void>;

  /** Store a photo blob, returning its key. */
  putPhoto(id: string, blob: Blob): Promise<void>;
  /** Read a photo blob, or null if it's missing. */
  getPhoto(id: string): Promise<Blob | null>;
  /** Delete a photo blob. Safe to call for an id that isn't there. */
  deletePhoto(id: string): Promise<void>;
}

const DATA_KEY = "sbt:data:v1";
const photoKey = (id: string) => `sbt:photo:${id}`;

export const EMPTY_DATA: AppData = { reviewers: [], visits: [], ratings: [] };

/**
 * Coerce whatever came out of storage into a well-formed AppData.
 *
 * Storage is not a trusted source: a partial write, a hand-edited value in
 * devtools, or a future schema change can all produce something that isn't
 * shaped like AppData. Rather than let that crash the app on boot, missing or
 * non-array collections fall back to empty.
 */
function normalize(raw: unknown): AppData {
  if (!raw || typeof raw !== "object") return { ...EMPTY_DATA };
  const data = raw as Partial<AppData>;
  return {
    reviewers: Array.isArray(data.reviewers) ? data.reviewers : [],
    visits: Array.isArray(data.visits) ? data.visits : [],
    ratings: Array.isArray(data.ratings) ? data.ratings : [],
  };
}

class IndexedDbRepository implements Repository {
  /**
   * Apply one pure mutation to the stored dataset.
   *
   * `update` runs the read, the transform, and the write inside a single
   * IndexedDB transaction. A hand-rolled `load()` then `save()` would not:
   * two mutations fired in quick succession — tapping Add twice, or a save
   * racing a delete — can interleave their reads and the second write then
   * silently discards the first change.
   */
  private apply(transform: (data: AppData) => AppData): Promise<void> {
    return update(DATA_KEY, (raw) => transform(normalize(raw)));
  }

  async load(): Promise<AppData> {
    try {
      return normalize(await get(DATA_KEY));
    } catch (error) {
      // A failed read must not brick the app — a private-mode browser or a
      // blocked-storage setting should still give a usable (if empty) session.
      console.error("Failed to load data from IndexedDB", error);
      return { ...EMPTY_DATA };
    }
  }

  addReviewer(reviewer: Reviewer): Promise<void> {
    return this.apply((data) => mutations.addReviewer(data, reviewer));
  }

  renameReviewer(id: string, name: string): Promise<void> {
    return this.apply((data) => mutations.renameReviewer(data, id, name));
  }

  deleteReviewer(id: string): Promise<void> {
    return this.apply((data) => mutations.deleteReviewer(data, id));
  }

  addVisit(visit: BurgerVisit, ratings: Rating[]): Promise<void> {
    return this.apply((data) => mutations.addVisit(data, visit, ratings));
  }

  async deleteVisit(visitId: string): Promise<void> {
    // Read the photo id before the record goes, so the blob can be cleaned up
    // afterwards. Deleting the record is what the user asked for and must
    // succeed; an orphaned blob is a little wasted space, so the photo delete
    // comes second and is allowed to fail quietly.
    const photoId = mutations.photoIdForVisit(await this.load(), visitId);
    await this.apply((data) => mutations.deleteVisit(data, visitId));
    if (photoId) await this.deletePhoto(photoId);
  }

  async putPhoto(id: string, blob: Blob): Promise<void> {
    await set(photoKey(id), blob);
  }

  async getPhoto(id: string): Promise<Blob | null> {
    try {
      return (await get<Blob>(photoKey(id))) ?? null;
    } catch (error) {
      console.error("Failed to load photo", id, error);
      return null;
    }
  }

  async deletePhoto(id: string): Promise<void> {
    try {
      await del(photoKey(id));
    } catch (error) {
      // An orphaned blob wastes a little space but is not worth failing a
      // delete over — the record it belonged to is already gone.
      console.error("Failed to delete photo", id, error);
    }
  }
}

/**
 * The repository the app runs on.
 *
 * This is the one line the whole boundary exists to protect. With Supabase
 * configured the app reads and writes Postgres; without it, IndexedDB, exactly
 * as before. No screen, component, or store action changes either way — and
 * `npm run dev` still works with no `.env.local` at all.
 */
export const repository: Repository = isSupabaseConfigured
  ? new SupabaseRepository()
  : new IndexedDbRepository();
