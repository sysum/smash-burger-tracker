import { Navigate } from "react-router-dom";
import { useAuth } from "@/store/AuthStore";
import type { ReactNode } from "react";

/**
 * Gate for the screens that change data.
 *
 * This is a redirect, not a security boundary — the database refuses an
 * anonymous write whether or not this component renders. What it prevents is a
 * signed-out visitor filling in a whole burger and five scorecards before
 * discovering they can't save it.
 *
 * Waiting on `ready` matters: the stored session is read asynchronously, so
 * rendering immediately would bounce an already-signed-in user to the sign-in
 * screen for a frame on every cold start.
 */
export function RequireWriteAccess({ children }: { children: ReactNode }) {
  const { ready, canWrite } = useAuth();

  if (!ready) return null;
  if (!canWrite) return <Navigate to="/signin" replace />;
  return <>{children}</>;
}
