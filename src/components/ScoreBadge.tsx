import { formatTenPoint } from "@/lib/scoring";

/**
 * The headline number. Renders on the 10-point scale, which is the scale the
 * product speaks in everywhere a score is shown to a person; the 0-100 form
 * stays internal to the maths and the breakdown view.
 */
export function ScoreBadge({
  score,
  size = "md",
  showScale = true,
}: {
  /** 0-100 score, or null when the burger has no ratings yet. */
  score: number | null;
  size?: "sm" | "md" | "xl";
  showScale?: boolean;
}) {
  if (score === null) {
    return (
      <div className={`score score--${size} score--unrated`} aria-label="Not yet rated">
        <span className="score__value">—</span>
      </div>
    );
  }

  const display = formatTenPoint(score);
  return (
    <div className={`score score--${size}`} aria-label={`${display} out of 10`}>
      <span className="score__value">{display}</span>
      {showScale && <span className="score__scale" aria-hidden="true">/10</span>}
    </div>
  );
}
