import { RATING_SCALE, type CategoryScores } from "@/lib/scoring";
import type { CategoryKey, RatingValue } from "@/types";

/** Whole numbers anchor the ruler; halves are the fine adjustment between them. */
const isHalf = (value: RatingValue) => value % 1 !== 0;

/**
 * One category's rating control: a nine-segment ruler from 1 to 5.
 *
 * Chosen over a slider because a slider needs a press, a drag, and a release
 * to land on a value, and half-point snapping on a ~340px track is fiddly with
 * a thumb. Nine discrete targets is one tap per category — five taps to
 * complete a whole scorecard.
 *
 * Rendered as a radiogroup so it announces properly to screen readers and
 * responds to arrow keys on the web.
 */
export function RatingRow({
  categoryKey,
  label,
  weight,
  value,
  onChange,
}: {
  categoryKey: CategoryKey;
  label: string;
  weight: number;
  value: RatingValue;
  onChange: (key: keyof CategoryScores, value: RatingValue) => void;
}) {
  return (
    <div className="rating-row">
      <div className="rating-row__head">
        <div className="row" style={{ gap: "var(--space-2)" }}>
          <span className="rating-row__label" id={`label-${categoryKey}`}>
            {label}
          </span>
          <span className="rating-row__weight">{weight}%</span>
        </div>
        <span className="rating-row__value">{value.toFixed(1)}</span>
      </div>

      <div className="scale" role="radiogroup" aria-labelledby={`label-${categoryKey}`}>
        {RATING_SCALE.map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={option === value}
            aria-label={`${option} out of 5`}
            className={`scale__btn${isHalf(option) ? " scale__btn--half" : ""}`}
            onClick={() => onChange(categoryKey, option)}
          >
            {isHalf(option) ? option.toFixed(1) : option}
          </button>
        ))}
      </div>
    </div>
  );
}
