import { chromium, devices } from "playwright";

const BASE = process.env.E2E_BASE_URL ?? "http://127.0.0.1:4173";
const SHOTS = process.env.E2E_SHOTS ?? "./e2e/screenshots";
const fail = [];
const check = (name, actual, expected) => {
  const ok = String(actual).trim() === String(expected);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}: got "${String(actual).trim()}"${ok ? "" : ` want "${expected}"`}`);
  if (!ok) fail.push(name);
};

const browser = await chromium.launch(
  process.env.E2E_CHROMIUM ? { executablePath: process.env.E2E_CHROMIUM } : {},
);
const ctx = await browser.newContext({ ...devices["iPhone 13"], isMobile: true, hasTouch: true });
const page = await ctx.newPage();
page.on("pageerror", (e) => { console.log("PAGEERROR:", e.message); fail.push("pageerror"); });
page.on("console", (m) => { if (m.type() === "error") console.log("CONSOLE ERROR:", m.text()); });

// --- reviewers -------------------------------------------------------------
await page.goto(`${BASE}/#/reviewers`, { waitUntil: "networkidle" });
for (const name of ["Sam", "Alex"]) {
  await page.getByLabel("New reviewer name").fill(name);
  await page.getByRole("button", { name: "Add", exact: true }).click();
}
await page.waitForTimeout(300);
check("reviewer count", await page.locator("li.card").count(), 2);
await page.screenshot({ path: `${SHOTS}/1-reviewers.png` });

// --- add burger: details ---------------------------------------------------
await page.goto(`${BASE}/#/add`, { waitUntil: "networkidle" });
await page.getByLabel("Restaurant").fill("Burger Shop");
await page.getByLabel("Burger", { exact: true }).fill("Double Smash");
await page.getByLabel("Location").fill("Costa Mesa, CA");
await page.getByLabel("Price").fill("$12.50");
await page.getByLabel("Notes").fill("Crispy lacy edges, great crust.");
await page.screenshot({ path: `${SHOTS}/2-add-details.png` });
await page.getByRole("button", { name: "Continue" }).click();

// --- add burger: reviewers -------------------------------------------------
await page.getByRole("button", { name: /^Sam/ }).click();
await page.getByRole("button", { name: /^Alex/ }).click();
await page.screenshot({ path: `${SHOTS}/3-pick-reviewers.png` });
await page.getByRole("button", { name: "Rate with 2" }).click();

// --- add burger: rating ----------------------------------------------------
// The spec's two worked examples, in category order.
const CARDS = [
  { who: "Sam",  scores: [4, 3.5, 4, 4, 3], expect: "7.7" },
  { who: "Alex", scores: [4, 5,   4, 5, 3], expect: "8.7" },
];

async function rate(scores) {
  const rows = page.locator(".rating-row");
  for (let i = 0; i < scores.length; i++) {
    await rows.nth(i).getByRole("radio", { name: `${scores[i]} out of 5`, exact: true }).click();
  }
}

await rate(CARDS[0].scores);
check("Sam live score /10", await page.locator(".live-score .score__value").innerText(), CARDS[0].expect);
check("Sam live score /100", await page.locator(".live-score__out-of-100").innerText(), "76.5 / 100");
await page.screenshot({ path: `${SHOTS}/4-rating.png` });

await page.getByRole("button", { name: /^Next: Alex/ }).click();
await rate(CARDS[1].scores);
check("Alex live score /10", await page.locator(".live-score .score__value").innerText(), CARDS[1].expect);
check("Alex live score /100", await page.locator(".live-score__out-of-100").innerText(), "87 / 100");

await page.getByRole("button", { name: "Save burger" }).click();

// --- detail ----------------------------------------------------------------
await page.waitForURL(/#\/burger\//);
await page.waitForTimeout(400);
check("detail headline score", await page.locator(".detail-hero .score__value").innerText(), "8.2");
check("detail 100-scale + reviewers",
  await page.locator(".page__subtitle").first().innerText(), "81.75 / 100 · 2 reviewers");
const cards = page.locator(".stack > .card.card--pad");
check("scorecard count", await cards.count(), 3); // category card + 2 reviewer cards
await page.screenshot({ path: `${SHOTS}/5-detail.png`, fullPage: true });

// --- leaderboard -----------------------------------------------------------
await page.getByRole("button", { name: /Leaderboard/ }).click();
await page.waitForTimeout(400);
check("leaderboard rank", await page.locator(".lb-card__rank").first().innerText(), "#1");
check("leaderboard score", await page.locator(".lb-card .score__value").first().innerText(), "8.2");
check("leaderboard restaurant", await page.locator(".lb-card__restaurant").first().innerText(), "Burger Shop");
const meta = (await page.locator(".lb-card__meta").first().innerText()).replace(/\s+/g, " ").trim();
const today = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
check("leaderboard meta", meta, `2 reviewers ${today}`);

await page.screenshot({ path: `${SHOTS}/6-leaderboard.png` });

// --- persistence across reload --------------------------------------------
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(600);
check("survives reload", await page.locator(".lb-card .score__value").first().innerText(), "8.2");

await browser.close();
console.log(fail.length ? `\n${fail.length} FAILED: ${fail.join(", ")}` : "\nAll end-to-end checks passed.");
process.exit(fail.length ? 1 : 0);
