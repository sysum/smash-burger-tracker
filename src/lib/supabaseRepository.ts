import { requireSupabase } from "@/lib/supabase";
import type { Repository } from "@/lib/repository";
import type { AppData, BurgerVisit, Rating, Reviewer } from "@/types";

/**
 * `Repository` backed by Postgres and Supabase Storage.
 *
 * Reads are public — anyone with the URL sees the leaderboard. Writes require a
 * signed-in user, enforced by row level security in the database rather than by
 * anything here; this file cannot grant itself access it does not have, which
 * is the point.
 *
 * The column names are snake_case because that is Postgres convention, and the
 * app's are camelCase because that is TypeScript's. The mapping lives in this
 * file and nowhere else — one boundary, crossed in two functions per table.
 */

const PHOTO_BUCKET = "burger-photos";
const photoPath = (id: string) => `${id}.jpg`;

// --- row shapes -------------------------------------------------------------

interface ReviewerRow {
  id: string;
  name: string;
  created_at: string;
}

interface VisitRow {
  id: string;
  restaurant_name: string;
  burger_name: string;
  location: string;
  date: string;
  price: number | string | null;
  notes: string;
  photo_id: string | null;
  created_at: string;
}

interface RatingRow {
  id: string;
  visit_id: string;
  reviewer_id: string;
  smash_texture: number | string;
  beef_flavor: number | string;
  cheese_toppings: number | string;
  bun: number | string;
  value: number | string;
}

// --- mapping ----------------------------------------------------------------

/**
 * Postgres `numeric` is arbitrary-precision, which JSON has no type for, so it
 * can arrive as either a number or a string depending on the client version.
 * Coercing here means a rating never reaches the scoring maths as "4.5" and
 * silently turns a weighted sum into string concatenation.
 */
const num = (value: number | string): number =>
  typeof value === "number" ? value : Number(value);

const optionalNum = (value: number | string | null): number | null =>
  value === null || value === "" ? null : num(value);

const toReviewer = (row: ReviewerRow): Reviewer => ({
  id: row.id,
  name: row.name,
  createdAt: row.created_at,
});

const toVisit = (row: VisitRow): BurgerVisit => ({
  id: row.id,
  restaurantName: row.restaurant_name,
  burgerName: row.burger_name,
  location: row.location,
  // Already a plain 'YYYY-MM-DD' string from a Postgres `date` column. Do not
  // wrap it in `new Date` on the way past — that reads it as UTC midnight and
  // renders as the previous day anywhere west of Greenwich.
  date: row.date,
  price: optionalNum(row.price),
  notes: row.notes,
  photoId: row.photo_id,
  createdAt: row.created_at,
});

const toRating = (row: RatingRow): Rating => ({
  id: row.id,
  // The app calls this `burgerVisitId`; the column is `visit_id`.
  burgerVisitId: row.visit_id,
  reviewerId: row.reviewer_id,
  smashTexture: num(row.smash_texture),
  beefFlavor: num(row.beef_flavor),
  cheeseToppings: num(row.cheese_toppings),
  bun: num(row.bun),
  value: num(row.value),
});

const fromVisit = (visit: BurgerVisit) => ({
  id: visit.id,
  restaurant_name: visit.restaurantName,
  burger_name: visit.burgerName,
  location: visit.location,
  date: visit.date,
  price: visit.price,
  notes: visit.notes,
  photo_id: visit.photoId,
  created_at: visit.createdAt,
});

const fromRating = (rating: Rating) => ({
  id: rating.id,
  visit_id: rating.burgerVisitId,
  reviewer_id: rating.reviewerId,
  smash_texture: rating.smashTexture,
  beef_flavor: rating.beefFlavor,
  cheese_toppings: rating.cheeseToppings,
  bun: rating.bun,
  value: rating.value,
});

// --- implementation ---------------------------------------------------------

export class SupabaseRepository implements Repository {
  async load(): Promise<AppData> {
    const db = requireSupabase();

    // Three round trips in parallel rather than one nested select: the app
    // holds these as three flat collections and joins them by id in
    // `lib/leaderboard.ts`, so a nested response would only have to be taken
    // apart again.
    const [reviewers, visits, ratings] = await Promise.all([
      db.from("reviewers").select("*").order("created_at"),
      db.from("visits").select("*").order("date", { ascending: false }),
      db.from("ratings").select("*"),
    ]);

    const failure = reviewers.error ?? visits.error ?? ratings.error;
    if (failure) throw new Error(`Failed to load data: ${failure.message}`);

    return {
      reviewers: (reviewers.data as ReviewerRow[]).map(toReviewer),
      visits: (visits.data as VisitRow[]).map(toVisit),
      ratings: (ratings.data as RatingRow[]).map(toRating),
    };
  }

  async addReviewer(reviewer: Reviewer): Promise<void> {
    const { error } = await requireSupabase().from("reviewers").insert({
      id: reviewer.id,
      name: reviewer.name,
      created_at: reviewer.createdAt,
    });
    if (error) throw new Error(`Failed to add reviewer: ${error.message}`);
  }

  async renameReviewer(id: string, name: string): Promise<void> {
    const trimmed = name.trim();
    if (!trimmed) return;
    const { error } = await requireSupabase()
      .from("reviewers")
      .update({ name: trimmed })
      .eq("id", id);
    if (error) throw new Error(`Failed to rename reviewer: ${error.message}`);
  }

  async deleteReviewer(id: string): Promise<void> {
    // Their ratings go with them via `on delete cascade`, which is the database
    // half of the same rule `lib/mutations.ts` applies in memory.
    const { error } = await requireSupabase().from("reviewers").delete().eq("id", id);
    if (error) throw new Error(`Failed to delete reviewer: ${error.message}`);
  }

  async addVisit(visit: BurgerVisit, ratings: Rating[]): Promise<void> {
    // One RPC rather than two inserts, so a failure cannot leave a burger
    // standing on the leaderboard with nobody's scores attached to it.
    const { error } = await requireSupabase().rpc("add_visit", {
      visit: fromVisit(visit),
      ratings: ratings.map(fromRating),
    });
    if (error) throw new Error(`Failed to save burger: ${error.message}`);
  }

  async deleteVisit(visitId: string): Promise<void> {
    const db = requireSupabase();

    // Read the photo id first — after the cascade there is nothing left to ask.
    const { data } = await db.from("visits").select("photo_id").eq("id", visitId).maybeSingle();

    const { error } = await db.from("visits").delete().eq("id", visitId);
    if (error) throw new Error(`Failed to delete burger: ${error.message}`);

    // The row is gone, which is what the user asked for. A stranded photo is a
    // little wasted storage, so it must not turn a successful delete into a
    // failed one.
    const photoId = (data as { photo_id: string | null } | null)?.photo_id ?? null;
    if (photoId) await this.deletePhoto(photoId);
  }

  async putPhoto(id: string, blob: Blob): Promise<void> {
    const { error } = await requireSupabase()
      .storage.from(PHOTO_BUCKET)
      .upload(photoPath(id), blob, { contentType: "image/jpeg", upsert: true });
    if (error) throw new Error(`Failed to upload photo: ${error.message}`);
  }

  async getPhoto(id: string): Promise<Blob | null> {
    try {
      const { data, error } = await requireSupabase()
        .storage.from(PHOTO_BUCKET)
        .download(photoPath(id));
      if (error) {
        console.error("Failed to load photo", id, error);
        return null;
      }
      return data;
    } catch (error) {
      // A missing photo must not take the burger's detail screen down with it.
      console.error("Failed to load photo", id, error);
      return null;
    }
  }

  async deletePhoto(id: string): Promise<void> {
    try {
      const { error } = await requireSupabase()
        .storage.from(PHOTO_BUCKET)
        .remove([photoPath(id)]);
      if (error) console.error("Failed to delete photo", id, error);
    } catch (error) {
      console.error("Failed to delete photo", id, error);
    }
  }
}
