import { useNavigate, useParams } from "react-router-dom";
import { ScoreBadge } from "@/components/ScoreBadge";
import { CategoryBars } from "@/components/CategoryBars";
import { BurgerPhoto } from "@/components/BurgerPhoto";
import { EmptyState } from "@/components/EmptyState";
import { useAppStore } from "@/store/AppStore";
import { formatDate, formatHundred, formatPrice, initials, pluralize } from "@/lib/format";
import {
  CATEGORIES,
  averageCategoryScores,
  toCategoryScores,
  weightedScore,
} from "@/lib/scoring";

export function BurgerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getScoredVisit, getReviewer, deleteVisit, ready } = useAppStore();

  const entry = id ? getScoredVisit(id) : null;

  if (!ready) return <div className="page" />;

  if (!entry) {
    return (
      <div className="page">
        <EmptyState
          emoji="🤷"
          title="Burger not found"
          body="This burger may have been deleted."
          action={
            <button className="btn btn--primary" onClick={() => navigate("/")}>
              Back to leaderboard
            </button>
          }
        />
      </div>
    );
  }

  const { visit, ratings, score, reviewerCount } = entry;
  const categoryScores = ratings.map(toCategoryScores);
  const averages = averageCategoryScores(categoryScores);

  const handleDelete = async () => {
    if (!window.confirm(`Delete ${visit.restaurantName}? This can't be undone.`)) return;
    await deleteVisit(visit.id);
    navigate("/", { replace: true });
  };

  return (
    <div className="page">
      <div className="topbar">
        <button className="topbar__back" onClick={() => navigate("/")}>
          ‹ Leaderboard
        </button>
        <button
          className="btn btn--ghost btn--sm"
          style={{ color: "var(--danger)" }}
          onClick={handleDelete}
        >
          Delete
        </button>
      </div>

      <div className="stack--loose stack">
        <div className="detail-hero">
          <div style={{ minWidth: 0 }}>
            <h1 className="detail-hero__name">{visit.restaurantName}</h1>
            <p className="detail-hero__burger">{visit.burgerName || "Smash burger"}</p>
          </div>
          <ScoreBadge score={score} size="xl" />
        </div>

        {score !== null && (
          <p className="page__subtitle" style={{ marginTop: "calc(var(--space-4) * -1)" }}>
            {formatHundred(score)} / 100 · {pluralize(reviewerCount, "reviewer")}
          </p>
        )}

        {visit.photoId && (
          <BurgerPhoto
            photoId={visit.photoId}
            alt={`${visit.burgerName || "Burger"} at ${visit.restaurantName}`}
          />
        )}

        <div className="facts">
          <div className="fact">
            <div className="fact__label">Price</div>
            <div className="fact__value">{formatPrice(visit.price)}</div>
          </div>
          <div className="fact">
            <div className="fact__label">Visited</div>
            <div className="fact__value">{formatDate(visit.date, "long")}</div>
          </div>
          {visit.location && (
            <div className="fact" style={{ gridColumn: "1 / -1" }}>
              <div className="fact__label">Location</div>
              <div className="fact__value">{visit.location}</div>
            </div>
          )}
        </div>

        {visit.notes && (
          <div className="stack--tight stack">
            <span className="section-label">Notes</span>
            <p className="notes">{visit.notes}</p>
          </div>
        )}

        {averages && (
          <div className="stack--tight stack">
            <span className="section-label">Average by category</span>
            <div className="card card--pad">
              <CategoryBars scores={averages} />
            </div>
          </div>
        )}

        <div className="stack--tight stack">
          <span className="section-label">Scorecards</span>
          {ratings.length === 0 ? (
            <p className="page__subtitle">Nobody has rated this burger yet.</p>
          ) : (
            ratings.map((rating) => {
              const reviewer = getReviewer(rating.reviewerId);
              // A rating can outlive its reviewer only in the window before
              // cascade deletion lands; label it rather than crashing.
              const name = reviewer?.name ?? "Former reviewer";
              const scores = toCategoryScores(rating);
              return (
                <div className="card card--pad stack" key={rating.id}>
                  <div className="row row--between">
                    <div className="row">
                      <span className="avatar" aria-hidden="true">
                        {initials(name)}
                      </span>
                      <span style={{ fontWeight: 700 }}>{name}</span>
                    </div>
                    <ScoreBadge score={weightedScore(scores)} size="sm" />
                  </div>
                  <ul className="stack--tight stack">
                    {CATEGORIES.map(({ key, label }) => (
                      <li className="row row--between" key={key} style={{ fontSize: 14 }}>
                        <span style={{ color: "var(--text-secondary)" }}>{label}</span>
                        <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                          {scores[key].toFixed(1)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
