import { describe, expect, it } from "vitest";
import { formatDate, formatHundred, formatPrice, initials, parsePrice, pluralize } from "./format";

describe("formatHundred", () => {
  it("keeps meaningful decimals but drops padding zeros", () => {
    expect(formatHundred(81.75)).toBe("81.75");
    expect(formatHundred(90)).toBe("90");
    expect(formatHundred(76.5)).toBe("76.5");
    expect(formatHundred(87.83)).toBe("87.83");
  });
});

describe("parsePrice", () => {
  it("strips currency symbols and whitespace", () => {
    expect(parsePrice("$12.50")).toBe(12.5);
    expect(parsePrice(" 15 ")).toBe(15);
  });

  it("returns null for empty or junk input", () => {
    expect(parsePrice("")).toBeNull();
    expect(parsePrice("free")).toBeNull();
  });
});

describe("formatPrice", () => {
  it("shows cents only when there are cents", () => {
    expect(formatPrice(12.5)).toBe("$12.50");
    expect(formatPrice(15)).toBe("$15");
  });

  it("shows an em dash when there is no price", () => {
    expect(formatPrice(null)).toBe("—");
  });
});

describe("formatDate", () => {
  it("renders the calendar date given, with no timezone shift", () => {
    // new Date("2026-03-01") would be UTC midnight and render as Feb 28
    // anywhere west of Greenwich; formatDate must not do that.
    expect(formatDate("2026-03-01")).toBe("Mar 1, 2026");
    expect(formatDate("2026-03-01", "long")).toBe("March 1, 2026");
  });
});

describe("pluralize", () => {
  it("agrees in number", () => {
    expect(pluralize(1, "reviewer")).toBe("1 reviewer");
    expect(pluralize(2, "reviewer")).toBe("2 reviewers");
    expect(pluralize(0, "burger")).toBe("0 burgers");
  });
});

describe("initials", () => {
  it("takes one letter from a single name and two from a full name", () => {
    expect(initials("Sam")).toBe("S");
    expect(initials("Sam Smith")).toBe("SS");
    expect(initials("  ")).toBe("?");
  });
});
