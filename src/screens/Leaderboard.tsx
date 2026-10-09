import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ScoreBadge } from "@/components/ScoreBadge";
import { EmptyState } from "@/components/EmptyState";
import { SORT_OPTIONS, useAppStore, type ScoredVisit, type SortKey } from "@/store/AppStore";
import { useAuth } from "@/store/AuthStore";
import { formatDate, pluralize } from "@/lib/format";

/** Medal styling for the podium, plain styling below it. */
function rankClass(rank: number, scored: boolean): string {
  if (!scored) return "";
  if (rank === 1) return " lb-card__rank--1";
  if (rank === 2) return " lb-card__rank--2";
  if (rank === 3) return " lb-card__rank--3";
  return "";
}

function LeaderboardRow({ entry, rank }: { entry: ScoredVisit; rank: number | null }) {
  const { visit, score, reviewerCount } = entry;
  return (
    <li>
      <Link to={`/burger/${visit.id}`} className="lb-card">
        <span className={`lb-card__rank${rankClass(rank ?? 0, score !== null)}`}>
          {rank === null ? "—" : `#${rank}`}
        </span>

        <span className="lb-card__body">
          <span className="lb-card__restaurant">{visit.restaurantName}</span>
          <span className="lb-card__burger">{visit.burgerName || "Smash burger"}</span>
          <span className="lb-card__meta">
            <span>{pluralize(reviewerCount, "reviewer")}</span>
            <span className="lb-card__dot">{formatDate(visit.date)}</span>
          </span>
        </span>

        <ScoreBadge score={score} size="md" showScale={false} />
      </Link>
    </li>
  );
}

export function Leaderboard() {
  const { leaderboard, ready } = useAppStore();
  const { canWrite } = useAuth();
  const [sort, setSort] = useState<SortKey>("highest");
  const navigate = useNavigate();

  const entries = leaderboard(sort);

  /**
   * Rank is a property of the ranking, not of the row, so it is only shown
   * when the list is actually ordered by score. Under "most recent" a "#1"
   * badge would claim the top row is the best burger when it is merely the
   * newest. Unrated burgers never take a rank.
   */
  const showRank = sort === "highest" || sort === "lowest";
  let awarded = 0;

  if (!ready) return <div className="page" />;

  if (entries.length === 0) {
    // A signed-out visitor is offered a way in rather than a button that only
    // bounces off the route guard. Same reasoning as the hidden add button in
    // AppShell: do not offer an action that ends in a redirect.
    return (
      <div className="page">
        <EmptyState
          emoji="🍔"
          title="No burgers yet"
          body={
            canWrite
              ? "Add the first smash burger you've tried and it'll show up here, ranked."
              : "No burgers have been rated yet. Sign in if you're one of the crew."
          }
          action={
            canWrite ? (
              <button className="btn btn--primary" onClick={() => navigate("/add")}>
                Add a burger
              </button>
            ) : (
              <button className="btn btn--primary" onClick={() => navigate("/signin")}>
                Sign in
              </button>
            )
          }
        />
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page__header">
        <div>
          <h1 className="page__title">Leaderboard</h1>
          <p className="page__subtitle">{pluralize(entries.length, "burger")} tried</p>
        </div>
      </header>

      <div className="chips" role="group" aria-label="Sort burgers">
        {SORT_OPTIONS.map((option) => (
          <button
            key={option.key}
            type="button"
            className="chip"
            aria-pressed={sort === option.key}
            onClick={() => setSort(option.key)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <ul className="stack" style={{ marginTop: "var(--space-4)" }}>
        {entries.map((entry) => {
          const rank = showRank && entry.score !== null ? ++awarded : null;
          return <LeaderboardRow key={entry.visit.id} entry={entry} rank={rank} />;
        })}
      </ul>
    </div>
  );
}
