import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * The Supabase client, or null when the app has not been given a backend.
 *
 * Both variables are inlined into the bundle by Vite at build time, so neither
 * is a secret — the publishable key identifies the project and grants nothing
 * on its own. Row level security is what protects the data.
 *
 * "Publishable" is the current name for what Supabase used to call the `anon`
 * key. Note that `anon` still means something different and unchanged: the
 * Postgres role an unauthenticated request runs as, which is what the RLS
 * policies in supabase/migrations target. The key was renamed; the role was
 * not. Its dangerous counterpart is the `secret` key (formerly `service_role`),
 * which bypasses RLS and must never appear in a `VITE_` variable — it would
 * ship to every visitor as full write access.
 *
 * Missing configuration is a supported state, not an error. `npm run dev` with
 * no `.env.local` still runs the app against IndexedDB, which keeps the test
 * suite, the offline story, and the Capacitor build working without a network
 * round trip to a project that may not exist yet.
 */
const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

export const isSupabaseConfigured = Boolean(url && publishableKey);

export const supabase: SupabaseClient<Database> | null = isSupabaseConfigured
  ? createClient<Database>(url!, publishableKey!, {
      auth: {
        // Keeps a signed-in crew member signed in across app launches, which
        // matters most on a phone that gets opened for ninety seconds at a
        // time in a restaurant.
        persistSession: true,
        autoRefreshToken: true,
        // The app is a HashRouter SPA: every route is `/#/...`, so the URL
        // fragment belongs to the router. Letting the auth client read session
        // tokens out of it would have the two fighting over the same string —
        // and with email OTP codes there is no callback URL to parse anyway.
        detectSessionInUrl: false,
      },
    })
  : null;

/** The client, or a thrown error. For code paths that cannot proceed without it. */
export function requireSupabase(): SupabaseClient<Database> {
  if (!supabase) {
    throw new Error(
      "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env.local.",
    );
  }
  return supabase;
}
