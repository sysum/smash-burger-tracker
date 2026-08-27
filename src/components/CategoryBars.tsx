import { CATEGORIES, MAX_RATING, type CategoryScores } from "@/lib/scoring";

/**
 * Average rating per category, on the 1-5 scale.
 *
 * The bar fills from the scale minimum, not from zero: 1.0 is the lowest
 * possible rating, so a bar that still looks 20% full at the worst score would
 * misread. An empty bar means "as low as it goes".
 */
export function CategoryBars({ scores }: { scores: CategoryScores }) {
  return (
    <div className="stack">
      {CATEGORIES.map(({ key, label, weight }) => {
        const value = scores[key];
        const pct = ((value - 1) / (MAX_RATING - 1)) * 100;
        return (
          <div className="cat-bar" key={key}>
            <div className="cat-bar__head">
              <span className="cat-bar__label">
                {label}{" "}
                <span className="rating-row__weight" style={{ marginLeft: 2 }}>
                  {weight}%
                </span>
              </span>
              <span className="cat-bar__value">{value.toFixed(1)}</span>
            </div>
            <div
              className="cat-bar__track"
              role="meter"
              aria-valuenow={value}
              aria-valuemin={1}
              aria-valuemax={MAX_RATING}
              aria-label={label}
            >
              <div className="cat-bar__fill" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
