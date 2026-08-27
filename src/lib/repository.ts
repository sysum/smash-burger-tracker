import { del, get, set } from "idb-keyval";
import type { AppData } from "@/types";

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
 * Why IndexedDB rather than localStorage: localStorage caps around 5MB and
 * stores strings only, so burger photos would either blow the quota or need
 * base64 encoding (a 33% size penalty on top). IndexedDB stores Blobs natively
 * and has a far larger quota. It also maps cleanly onto Capacitor's SQLite and
 * Filesystem plugins later.
 */
export interface Repository {
  /** Read the whole dataset. Returns empty collections on first run. */
  load(): Promise<AppData>;
  /** Write the whole dataset. */
  save(data: AppData): Promise<void>;
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

  async save(data: AppData): Promise<void> {
    await set(DATA_KEY, data);
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

export const repository: Repository = new IndexedDbRepository();
