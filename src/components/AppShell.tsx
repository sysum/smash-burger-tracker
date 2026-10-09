import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/store/AuthStore";

/**
 * Persistent bottom navigation, with the add-burger action as a centre FAB —
 * the primary action lives under the thumb, and the two browsing destinations
 * flank it.
 *
 * Hidden on the add flow, which owns the full screen and has its own sticky
 * action bar; a nav bar there would compete with it and add a second way out.
 *
 * A signed-out visitor gets a read-only shell: the add button and the reviewer
 * editor are replaced by a way in. Both routes are guarded anyway, so this is
 * about not offering an action that ends in a redirect.
 */
export function AppShell() {
  const { pathname } = useLocation();
  const { canWrite } = useAuth();
  const hideNav = pathname.startsWith("/add") || pathname.startsWith("/signin");

  return (
    <div className="app-shell">
      <Outlet />

      {!hideNav && (
        <nav className="nav">
          <div className="nav__inner">
            <NavLink to="/" className="nav__link" end>
              <span className="nav__icon" aria-hidden="true">
                🏆
              </span>
              Leaderboard
            </NavLink>

            {canWrite && (
              <Link to="/add" className="nav__fab" aria-label="Add a burger">
                +
              </Link>
            )}

            {canWrite ? (
              <NavLink to="/reviewers" className="nav__link">
                <span className="nav__icon" aria-hidden="true">
                  👥
                </span>
                Reviewers
              </NavLink>
            ) : (
              <NavLink to="/signin" className="nav__link">
                <span className="nav__icon" aria-hidden="true">
                  🔑
                </span>
                Sign in
              </NavLink>
            )}
          </div>
        </nav>
      )}
    </div>
  );
}
