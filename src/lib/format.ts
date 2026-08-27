/** Today as `YYYY-MM-DD` in the device's own timezone. */
export function todayIso(): string {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10);
}

/**
 * Format a `YYYY-MM-DD` date for display.
 *
 * Parsed field-by-field rather than via `new Date(iso)`: the Date constructor
 * reads a bare `YYYY-MM-DD` as UTC midnight, which renders as the *previous*
 * day for anyone west of Greenwich.
 */
export function formatDate(iso: string, style: "short" | "long" = "short"): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, {
    month: style === "long" ? "long" : "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Format a dollar price, or an em dash when there isn't one. */
export function formatPrice(price: number | null): string {
  if (price === null || !Number.isFinite(price)) return "—";
  return price.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: price % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

/** "1 reviewer" / "3 reviewers" */
export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** Parse a free-text price field into a number, or null if it's empty/invalid. */
export function parsePrice(input: string): number | null {
  const cleaned = input.replace(/[^0-9.]/g, "");
  if (cleaned === "") return null;
  const value = Number.parseFloat(cleaned);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

/** First-letter initials for a reviewer avatar, e.g. "Sam" -> "S". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Format a 0-100 score without trailing zeros: 81.75 stays "81.75", but 90
 * reads "90" rather than "90.00". Averages land on whole numbers often enough
 * that the padding is more noise than precision.
 */
export function formatHundred(score: number): string {
  return Number(score.toFixed(2)).toString();
}
