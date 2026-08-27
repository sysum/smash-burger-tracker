import { describe, expect, it } from "vitest";
import { scoreVisits, sortScoredVisits, type ScoredVisit } from "./leaderboard";
import type { BurgerVisit, Rating } from "@/types";

function visit(id: string, date: string, createdAt = `${date}T12:00:00.000Z`): BurgerVisit {
  return {
    id,
    restaurantName: `Shop ${id}`,
    burgerName: "Double Smash",
    location: "",
    date,
    price: null,
    notes: "",
    photoId: null,
    createdAt,
  };
}

/** A rating where every category is `value`, so the weighted score is value/5*100. */
function flatRating(id: string, visitId: string, reviewerId: string, value: number): Rating {
  return {
    id,
    burgerVisitId: visitId,
    reviewerId,
    smashTexture: value,
    beefFlavor: value,
    cheeseToppings: value,
    bun: value,
    value,
  };
}

const keys = (entries: ScoredVisit[]) => entries.map((e) => e.visit.id);

describe("scoreVisits", () => {
  it("attaches each visit's own ratings and nothing else", () => {
    const visits = [visit("a", "2026-01-01"), visit("b", "2026-01-02")];
    const ratings = [
      flatRating("r1", "a", "p1", 4),
      flatRating("r2", "a", "p2", 5),
      flatRating("r3", "b", "p1", 3),
    ];
    const [a, b] = scoreVisits(visits, ratings);

    expect(a.reviewerCount).toBe(2);
    expect(a.score).toBe(90); // mean of 80 and 100
    expect(b.reviewerCount).toBe(1);
    expect(b.score).toBe(60);
  });

  it("gives a visit with no ratings a null score, not zero", () => {
    const [entry] = scoreVisits([visit("a", "2026-01-01")], []);
    expect(entry.score).toBeNull();
    expect(entry.reviewerCount).toBe(0);
  });

  it("ignores ratings whose visit no longer exists", () => {
    const entries = scoreVisits([visit("a", "2026-01-01")], [
      flatRating("r1", "a", "p1", 4),
      flatRating("r2", "ghost", "p1", 1),
    ]);
    expect(entries).toHaveLength(1);
    expect(entries[0].score).toBe(80);
  });
});

describe("sortScoredVisits", () => {
  // c is the best but oldest; a is mid; b is unrated and newest.
  const entries = scoreVisits(
    [visit("a", "2026-03-01"), visit("b", "2026-06-01"), visit("c", "2026-01-01")],
    [flatRating("r1", "a", "p1", 3), flatRating("r2", "c", "p1", 5)],
  );

  it("ranks highest score first", () => {
    expect(keys(sortScoredVisits(entries, "highest"))).toEqual(["c", "a", "b"]);
  });

  it("ranks lowest score first", () => {
    expect(keys(sortScoredVisits(entries, "lowest"))).toEqual(["a", "c", "b"]);
  });

  it("puts unrated burgers last under BOTH score sorts", () => {
    // The interesting case: "b" is unrated. It must not lead "lowest rated"
    // by being treated as a zero, nor lead "highest rated" as a perfect score.
    expect(keys(sortScoredVisits(entries, "highest")).at(-1)).toBe("b");
    expect(keys(sortScoredVisits(entries, "lowest")).at(-1)).toBe("b");
  });

  it("sorts most recent and oldest as exact reverses", () => {
    expect(keys(sortScoredVisits(entries, "recent"))).toEqual(["b", "a", "c"]);
    expect(keys(sortScoredVisits(entries, "oldest"))).toEqual(["c", "a", "b"]);
  });

  it("includes unrated burgers in date sorts", () => {
    // Date order is meaningful for every burger, rated or not.
    expect(keys(sortScoredVisits(entries, "recent"))).toContain("b");
    expect(sortScoredVisits(entries, "recent")).toHaveLength(3);
  });

  it("breaks score ties with the newer burger first", () => {
    const tied = scoreVisits(
      [visit("old", "2026-01-01"), visit("new", "2026-05-01")],
      [flatRating("r1", "old", "p1", 4), flatRating("r2", "new", "p1", 4)],
    );
    expect(tied[0].score).toBe(tied[1].score);
    expect(keys(sortScoredVisits(tied, "highest"))).toEqual(["new", "old"]);
  });

  it("breaks same-day ties by creation time, newest first", () => {
    const sameDay = scoreVisits(
      [
        visit("first", "2026-04-01", "2026-04-01T18:00:00.000Z"),
        visit("second", "2026-04-01", "2026-04-01T20:00:00.000Z"),
      ],
      [],
    );
    expect(keys(sortScoredVisits(sameDay, "recent"))).toEqual(["second", "first"]);
  });

  it("does not mutate the array it is given", () => {
    const original = [...entries];
    sortScoredVisits(entries, "highest");
    expect(entries).toEqual(original);
  });

  it("handles an empty leaderboard", () => {
    expect(sortScoredVisits([], "highest")).toEqual([]);
  });
});
