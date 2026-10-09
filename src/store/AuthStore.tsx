import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

/**
 * Who is signed in, and how to change that.
 *
 * The app is public-read, private-write: anyone can see the leaderboard, only
 * a signed-in crew member can change it. This store answers "may this person
 * write", but it is not what *enforces* it — row level security in Postgres
 * is. Everything here is presentation: hiding a button the database would
 * refuse anyway is a courtesy to the user, not a security boundary. Never move
 * an authorisation decision up here.
 *
 * Sign-in is a six-digit emailed code rather than a magic link. A link has to
 * redirect somewhere, and Capacitor's `capacitor://localhost` origin makes that
 * a custom URL scheme and a deep-link listener. A code has no redirect at all
 * and behaves identically on the web and in the native wrapper.
 */
interface AuthStoreValue {
  /** False until the stored session has been checked, to avoid a sign-in flash. */
  ready: boolean;
  session: Session | null;
  /** May the current visitor change data? False for anonymous readers. */
  canWrite: boolean;
  /** True when the app has no backend at all and runs on local storage. */
  isLocalOnly: boolean;

  /** Email a six-digit code. */
  sendCode: (email: string) => Promise<void>;
  /** Exchange the code for a session. */
  verifyCode: (email: string, code: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthStoreContext = createContext<AuthStoreValue | null>(null);

export function AuthStoreProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!isSupabaseConfigured);

  useEffect(() => {
    if (!supabase) return;

    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      setReady(true);
    });

    // Covers sign-out, token refresh, and a session expiring while the app sits
    // open on a phone — all of which change what the user may do without them
    // touching anything.
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const sendCode = useCallback(async (email: string) => {
    if (!supabase) throw new Error("Sign-in needs a configured backend.");
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        // Sign-ups are disabled in the dashboard, so this only matters as a
        // second statement of intent: this call signs existing crew in, it
        // never creates an account.
        shouldCreateUser: false,
      },
    });
    if (error) throw new Error(error.message);
  }, []);

  const verifyCode = useCallback(async (email: string, code: string) => {
    if (!supabase) throw new Error("Sign-in needs a configured backend.");
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: "email",
    });
    if (error) throw new Error(error.message);
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  }, []);

  const value = useMemo(
    (): AuthStoreValue => ({
      ready,
      session,
      // With no backend configured the app is a single-user local notebook and
      // there is nobody to sign in as, so everything stays editable.
      canWrite: !isSupabaseConfigured || session !== null,
      isLocalOnly: !isSupabaseConfigured,
      sendCode,
      verifyCode,
      signOut,
    }),
    [ready, session, sendCode, verifyCode, signOut],
  );

  return <AuthStoreContext.Provider value={value}>{children}</AuthStoreContext.Provider>;
}

export function useAuth(): AuthStoreValue {
  const context = useContext(AuthStoreContext);
  if (!context) throw new Error("useAuth must be used inside AuthStoreProvider");
  return context;
}
