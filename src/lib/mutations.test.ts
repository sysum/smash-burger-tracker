import { describe, expect, it } from "vitest";
import * as mutations from "@/lib/mutations";
import type { AppData, BurgerVisit, Rating, Reviewer } from "@/types";

const reviewer = (id: string, name: string): Reviewer => ({
  id,
  name,
  createdAt: "2026-01-01T00:00:00.000Z",
});

const visit = (id: string, photoId: string | null = null): BurgerVisit => ({
  id,
  restaurantName: "Smash Co",
  burgerName: "Double",
  location: "Austin",
  date: "2026-01-01",
  price: 12,
  notes: "",
  photoId,
  createdAt: "2026-01-01T00:00:00.000Z",
});

const rating = (id: string, visitId: string, reviewerId: string): Rating => ({
  id,
  burgerVisitId: visitId,
  reviewerId,
  smashTexture: 4,
  beefFlavor: 4,
  cheeseToppings: 4,
  bun: 4,
  value: 4,
});

/** Two reviewers, two burgers, one scorecard each per burger. */
function seed(): AppData {
  return {
    reviewers: [reviewer("r1", "Sam"), reviewer("r2", "Alex")],
    visits: [visit("v1"), visit("v2", "p2")],
    ratings: [
      rating("t1", "v1", "r1"),
      rating("t2", "v1", "r2"),
      rating("t3", "v2", "r1"),
    ],
  };
}

describe("addReviewer", () => {
  it("appends the reviewer", () => {
    const next = mutations.addReviewer(seed(), reviewer("r3", "Jo"));
    expect(next.reviewers.map((r) => r.id)).toEqual(["r1", "r2", "r3"]);
  });
});

describe("renameReviewer", () => {
  it("renames only the matching reviewer", () => {
    const next = mutations.renameReviewer(seed(), "r2", "Alexandra");
    expect(next.reviewers.map((r) => r.name)).toEqual(["Sam", "Alexandra"]);
  });

  it("trims surrounding whitespace", () => {
    const next = mutations.renameReviewer(seed(), "r1", "  Sam K.  ");
    expect(next.reviewers[0].name).toBe("Sam K.");
  });

  it("ignores a blank name rather than erasing the existing one", () => {
    const data = seed();
    expect(mutations.renameReviewer(data, "r1", "   ")).toBe(data);
  });
});

describe("deleteReviewer", () => {
  it("deletes the reviewer's scorecards along with them", () => {
    // The invariant that matters: an orphaned rating would keep a deleted
    // person's numbers folded into every burger average they contributed to.
    const next = mutations.deleteReviewer(seed(), "r1");
    expect(next.reviewers.map((r) => r.id)).toEqual(["r2"]);
    expect(next.ratings.map((r) => r.id)).toEqual(["t2"]);
  });

  it("leaves burgers standing, even ones that lose every rating", () => {
    const next = mutations.deleteReviewer(seed(), "r1");
    expect(next.visits.map((v) => v.id)).toEqual(["v1", "v2"]);
  });
});

describe("addVisit", () => {
  it("adds the burger and its scorecards together", () => {
    const next = mutations.addVisit(seed(), visit("v3"), [
      rating("t4", "v3", "r1"),
      rating("t5", "v3", "r2"),
    ]);
    expect(next.visits.map((v) => v.id)).toEqual(["v1", "v2", "v3"]);
    expect(next.ratings.map((r) => r.id)).toEqual(["t1", "t2", "t3", "t4", "t5"]);
  });

  it("accepts a burger with no ratings yet", () => {
    const next = mutations.addVisit(seed(), visit("v3"), []);
    expect(next.visits).toHaveLength(3);
    expect(next.ratings).toHaveLength(3);
  });
});

describe("deleteVisit", () => {
  it("deletes the burger and only its own scorecards", () => {
    const next = mutations.deleteVisit(seed(), "v1");
    expect(next.visits.map((v) => v.id)).toEqual(["v2"]);
    expect(next.ratings.map((r) => r.id)).toEqual(["t3"]);
  });

  it("leaves reviewers alone", () => {
    const next = mutations.deleteVisit(seed(), "v1");
    expect(next.reviewers).toHaveLength(2);
  });
});

describe("photoIdForVisit", () => {
  it("finds the photo a burger owns", () => {
    expect(mutations.photoIdForVisit(seed(), "v2")).toBe("p2");
  });

  it("returns null for a burger with no photo and for an unknown id", () => {
    expect(mutations.photoIdForVisit(seed(), "v1")).toBeNull();
    expect(mutations.photoIdForVisit(seed(), "nope")).toBeNull();
  });
});

describe("every mutation", () => {
  // The store applies these to React state, where mutating the previous value
  // in place would skip a re-render.
  it("leaves the input untouched", () => {
    const data = seed();
    const snapshot = structuredClone(data);

    mutations.addReviewer(data, reviewer("r3", "Jo"));
    mutations.renameReviewer(data, "r1", "Other");
    mutations.deleteReviewer(data, "r1");
    mutations.addVisit(data, visit("v3"), [rating("t4", "v3", "r1")]);
    mutations.deleteVisit(data, "v1");

    expect(data).toEqual(snapshot);
  });
});
