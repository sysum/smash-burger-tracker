import { Link, NavLink, Outlet, useLocation } from "react-router-dom";

/**
 * Persistent bottom navigation, with the add-burger action as a centre FAB —
 * the primary action lives under the thumb, and the two browsing destinations
 * flank it.
 *
 * Hidden on the add flow, which owns the full screen and has its own sticky
 * action bar; a nav bar there would compete with it and add a second way out.
 */
export function AppShell() {
  const { pathname } = useLocation();
  const hideNav = pathname.startsWith("/add");

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

            <Link to="/add" className="nav__fab" aria-label="Add a burger">
              +
            </Link>

            <NavLink to="/reviewers" className="nav__link">
              <span className="nav__icon" aria-hidden="true">
                👥
              </span>
              Reviewers
            </NavLink>
          </div>
        </nav>
      )}
    </div>
  );
}
