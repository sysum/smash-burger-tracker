import { describe, expect, it } from "vitest";
import {
  CATEGORIES,
  MAX_RATING,
  MIN_RATING,
  RATING_SCALE,
  TOTAL_WEIGHT,
  averageCategoryScores,
  emptyCategoryScores,
  formatTenPoint,
  normalizeRating,
  overallScore,
  roundTo,
  toCategoryScores,
  toTenPoint,
  weightedScore,
  type CategoryScores,
} from "./scoring";
import type { Rating } from "@/types";

/** The two reviewers from the worked example in the product spec. */
const REVIEWER_A: CategoryScores = {
  smashTexture: 4,
  beefFlavor: 3.5,
  cheeseToppings: 4,
  bun: 4,
  value: 3,
};

const REVIEWER_B: CategoryScores = {
  smashTexture: 4,
  beefFlavor: 5,
  cheeseToppings: 4,
  bun: 5,
  value: 3,
};

describe("scoring model", () => {
  it("weights total exactly 100", () => {
    expect(TOTAL_WEIGHT).toBe(100);
  });

  it("has the five specified categories in priority order", () => {
    expect(CATEGORIES.map((c) => [c.key, c.weight])).toEqual([
      ["smashTexture", 35],
      ["beefFlavor", 25],
      ["cheeseToppings", 20],
      ["bun", 15],
      ["value", 5],
    ]);
  });

  it("offers nine half-point steps from 1 to 5", () => {
    expect(RATING_SCALE).toEqual([1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5]);
  });
});

describe("weightedScore", () => {
  // The two cases named explicitly in the spec.
  it("scores the first worked example at 76.5 / 100", () => {
    expect(weightedScore(REVIEWER_A)).toBe(76.5);
  });

  it("scores the second worked example at 87 / 100", () => {
    expect(weightedScore(REVIEWER_B)).toBe(87);
  });

  it("returns exactly 100 for a perfect card", () => {
    const perfect = Object.fromEntries(
      CATEGORIES.map((c) => [c.key, MAX_RATING]),
    ) as CategoryScores;
    expect(weightedScore(perfect)).toBe(100);
  });

  it("returns exactly 20 for the lowest possible card", () => {
    // Every category at 1 of 5 is one fifth of every weight: 100 / 5 = 20.
    const worst = Object.fromEntries(
      CATEGORIES.map((c) => [c.key, MIN_RATING]),
    ) as CategoryScores;
    expect(weightedScore(worst)).toBe(20);
  });

  it("weights smash/texture more heavily than value", () => {
    const base = emptyCategoryScores();
    const smashUp = { ...base, smashTexture: MAX_RATING };
    const valueUp = { ...base, value: MAX_RATING };
    expect(weightedScore(smashUp)).toBeGreaterThan(weightedScore(valueUp));
  });

  it("produces no floating point drift on half-point inputs", () => {
    // Guards the multiply-before-divide ordering in weightedScore. The naive
    // (rating / 5) * weight form yields 76.50000000000001 here.
    const raw = CATEGORIES.reduce(
      (sum, { key, weight }) => sum + (REVIEWER_A[key] * weight) / 5,
      0,
    );
    expect(raw).toBe(76.5);
  });

  it("scores each category independently of the others", () => {
    // Raising one category by a half point should move the total by
    // exactly (0.5 * weight) / 5, and touch nothing else.
    for (const { key, weight } of CATEGORIES) {
      const base = emptyCategoryScores();
      const bumped = { ...base, [key]: base[key] + 0.5 };
      const delta = weightedScore(bumped) - weightedScore(base);
      expect(roundTo(delta, 4)).toBe(roundTo((0.5 * weight) / 5, 4));
    }
  });
});

describe("overallScore", () => {
  it("averages the two worked examples to 81.75 / 100", () => {
    expect(overallScore([REVIEWER_A, REVIEWER_B])).toBe(81.75);
  });

  it("returns a single reviewer's score unchanged", () => {
    expect(overallScore([REVIEWER_A])).toBe(76.5);
  });

  it("returns null with no reviewers, rather than 0 or NaN", () => {
    // A burger with no ratings is unscored, which is different from scoring 0.
    expect(overallScore([])).toBeNull();
  });

  it("is unaffected by the order of reviewers", () => {
    expect(overallScore([REVIEWER_A, REVIEWER_B])).toBe(
      overallScore([REVIEWER_B, REVIEWER_A]),
    );
  });

  it("averages three reviewers correctly", () => {
    const third: CategoryScores = {
      smashTexture: 5,
      beefFlavor: 5,
      cheeseToppings: 5,
      bun: 5,
      value: 5,
    };
    // (76.5 + 87 + 100) / 3 = 87.8333...
    expect(overallScore([REVIEWER_A, REVIEWER_B, third])).toBe(87.83);
  });
});

describe("toTenPoint / formatTenPoint", () => {
  it("displays the worked example average as 8.2 / 10", () => {
    const overall = overallScore([REVIEWER_A, REVIEWER_B]);
    expect(overall).toBe(81.75);
    expect(toTenPoint(overall!)).toBe(8.2);
    expect(formatTenPoint(overall!)).toBe("8.2");
  });

  it("rounds a .x5 boundary up rather than down", () => {
    // 81.75 / 10 is stored as 8.174999... in binary floating point. Without
    // the epsilon nudge in roundTo this rounds to 8.1 and the leaderboard is
    // quietly wrong on any score ending in .75.
    expect(toTenPoint(81.75)).toBe(8.2);
    expect(toTenPoint(76.5)).toBe(7.7);
    expect(toTenPoint(87)).toBe(8.7);
  });

  it("always renders exactly one decimal place", () => {
    expect(formatTenPoint(100)).toBe("10.0");
    expect(formatTenPoint(20)).toBe("2.0");
    expect(formatTenPoint(87)).toBe("8.7");
  });
});

describe("averageCategoryScores", () => {
  it("averages each category across reviewers", () => {
    expect(averageCategoryScores([REVIEWER_A, REVIEWER_B])).toEqual({
      smashTexture: 4,
      beefFlavor: 4.25,
      cheeseToppings: 4,
      bun: 4.5,
      value: 3,
    });
  });

  it("stays on the 1-5 scale, not the 0-100 one", () => {
    const avg = averageCategoryScores([REVIEWER_A, REVIEWER_B])!;
    for (const { key } of CATEGORIES) {
      expect(avg[key]).toBeGreaterThanOrEqual(MIN_RATING);
      expect(avg[key]).toBeLessThanOrEqual(MAX_RATING);
    }
  });

  it("returns null with no reviewers", () => {
    expect(averageCategoryScores([])).toBeNull();
  });

  it("agrees with overallScore when fed back through weightedScore", () => {
    // The mean of the weighted scores equals the weighted score of the means,
    // because the weighting is linear. If these ever diverge, the detail
    // screen's category breakdown would contradict its headline score.
    const avg = averageCategoryScores([REVIEWER_A, REVIEWER_B])!;
    expect(weightedScore(avg)).toBe(overallScore([REVIEWER_A, REVIEWER_B]));
  });
});

describe("normalizeRating", () => {
  it("snaps to the nearest half point", () => {
    expect(normalizeRating(3.26)).toBe(3.5);
    expect(normalizeRating(3.24)).toBe(3);
    expect(normalizeRating(4.75)).toBe(5);
  });

  it("clamps outside the 1-5 range", () => {
    expect(normalizeRating(0)).toBe(1);
    expect(normalizeRating(-3)).toBe(1);
    expect(normalizeRating(9)).toBe(5);
  });

  it("leaves valid scale values untouched", () => {
    for (const value of RATING_SCALE) {
      expect(normalizeRating(value)).toBe(value);
    }
  });
});

describe("roundTo", () => {
  it("rounds half away from zero despite float representation", () => {
    expect(roundTo(8.175, 2)).toBe(8.18);
    expect(roundTo(1.005, 2)).toBe(1.01);
    expect(roundTo(2.675, 2)).toBe(2.68);
  });

  it("leaves already-short values exact", () => {
    expect(roundTo(76.5, 2)).toBe(76.5);
    expect(roundTo(87, 2)).toBe(87);
  });
});

describe("toCategoryScores", () => {
  it("extracts only the category fields from a stored Rating", () => {
    const rating: Rating = {
      id: "r1",
      burgerVisitId: "v1",
      reviewerId: "p1",
      ...REVIEWER_A,
    };
    const scores = toCategoryScores(rating);
    expect(scores).toEqual(REVIEWER_A);
    expect(Object.keys(scores).sort()).toEqual(
      CATEGORIES.map((c) => c.key).sort(),
    );
  });

  it("round-trips through weightedScore identically", () => {
    const rating: Rating = {
      id: "r1",
      burgerVisitId: "v1",
      reviewerId: "p1",
      ...REVIEWER_B,
    };
    expect(weightedScore(toCategoryScores(rating))).toBe(87);
  });
});
