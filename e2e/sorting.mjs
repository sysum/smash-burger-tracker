import { chromium, devices } from "playwright";

const BASE = process.env.E2E_BASE_URL ?? "http://127.0.0.1:4173";
const SHOTS = process.env.E2E_SHOTS ?? "./e2e/screenshots";
const fail = [];
const check = (name, actual, expected) => {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  const ok = a === e;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}: ${a}${ok ? "" : ` want ${e}`}`);
  if (!ok) fail.push(name);
};

const flat = (id, visitId, v) => ({
  id, burgerVisitId: visitId, reviewerId: "p1",
  smashTexture: v, beefFlavor: v, cheeseToppings: v, bun: v, value: v,
});
const visit = (id, name, date) => ({
  id, restaurantName: name, burgerName: "Smash", location: "", date,
  price: null, notes: "", photoId: null, createdAt: `${date}T12:00:00.000Z`,
});

// Top = 100, Mid = 60, Unrated = no ratings and the newest of the three.
const seed = {
  reviewers: [{ id: "p1", name: "Sam", createdAt: "2026-01-01T00:00:00.000Z" }],
  visits: [
    visit("v1", "Top", "2026-02-01"),
    visit("v2", "Mid", "2026-03-01"),
    visit("v3", "Unrated", "2026-04-01"),
  ],
  ratings: [flat("r1", "v1", 5), flat("r2", "v2", 3)],
};

const browser = await chromium.launch(
  process.env.E2E_CHROMIUM ? { executablePath: process.env.E2E_CHROMIUM } : {},
);
const ctx = await browser.newContext({ ...devices["iPhone 13"], isMobile: true, hasTouch: true });
const page = await ctx.newPage();
page.on("pageerror", (e) => { console.log("PAGEERROR:", e.message); fail.push("pageerror"); });

await page.goto(BASE, { waitUntil: "networkidle" });

// Write straight into idb-keyval's default store, then reload so the app hydrates from it.
await page.evaluate(async (data) => {
  await new Promise((resolve, reject) => {
    const open = indexedDB.open("keyval-store", 1);
    open.onupgradeneeded = () => open.result.createObjectStore("keyval");
    open.onsuccess = () => {
      const tx = open.result.transaction("keyval", "readwrite");
      tx.objectStore("keyval").put(data, "sbt:data:v1");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    };
    open.onerror = () => reject(open.error);
  });
}, seed);

await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(600);

const names = () => page.locator(".lb-card__restaurant").allInnerTexts();
const ranks = () => page.locator(".lb-card__rank").allInnerTexts();
const scores = () => page.locator(".lb-card .score__value").allInnerTexts();

check("count", (await names()).length, 3);
check("highest order", await names(), ["Top", "Mid", "Unrated"]);
check("highest ranks", await ranks(), ["#1", "#2", "—"]);
check("highest scores", await scores(), ["10.0", "6.0", "—"]);
await page.screenshot({ path: `${SHOTS}/7-sort-highest.png` });

await page.getByRole("button", { name: "Lowest rated" }).click();
await page.waitForTimeout(250);
check("lowest order", await names(), ["Mid", "Top", "Unrated"]);
check("lowest ranks", await ranks(), ["#1", "#2", "—"]);

await page.getByRole("button", { name: "Most recent" }).click();
await page.waitForTimeout(250);
check("recent order", await names(), ["Unrated", "Mid", "Top"]);
// Rank badges must disappear when the list is not ordered by score.
check("recent ranks", await ranks(), ["—", "—", "—"]);
await page.screenshot({ path: `${SHOTS}/8-sort-recent.png` });

await page.getByRole("button", { name: "Oldest" }).click();
await page.waitForTimeout(250);
check("oldest order", await names(), ["Top", "Mid", "Unrated"]);
check("oldest ranks", await ranks(), ["—", "—", "—"]);

// Unrated burger's detail page must render rather than crash on a null score.
await page.getByText("Unrated").click();
await page.waitForURL(/#\/burger\//);
await page.waitForTimeout(300);
check("unrated detail score", await page.locator(".detail-hero .score__value").innerText(), "—");
check("unrated has no scorecards",
  await page.getByText("Nobody has rated this burger yet.").isVisible(), true);
await page.screenshot({ path: `${SHOTS}/9-unrated-detail.png` });

await browser.close();
console.log(fail.length ? `\n${fail.length} FAILED: ${fail.join(", ")}` : "\nAll sorting checks passed.");
process.exit(fail.length ? 1 : 0);
