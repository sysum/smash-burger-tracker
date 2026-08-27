import { chromium, devices } from "playwright";

const BASE = process.env.E2E_BASE_URL ?? "http://127.0.0.1:4173";
const SHOTS = process.env.E2E_SHOTS ?? "./e2e/screenshots";
const fail = [];
const check = (n, a, e) => {
  const ok = String(a) === String(e);
  console.log(`${ok ? "PASS" : "FAIL"}  ${n}: "${a}"${ok ? "" : ` want "${e}"`}`);
  if (!ok) fail.push(n);
};

const browser = await chromium.launch(
  process.env.E2E_CHROMIUM ? { executablePath: process.env.E2E_CHROMIUM } : {},
);
const ctx = await browser.newContext({ ...devices["iPhone 13"], isMobile: true, hasTouch: true, colorScheme: "dark" });
const page = await ctx.newPage();
page.on("pageerror", (e) => { console.log("PAGEERROR:", e.message); fail.push("pageerror"); });

await page.goto(`${BASE}/#/add`, { waitUntil: "networkidle" });
await page.getByLabel("Restaurant").fill("Night Shift Burgers");
await page.getByLabel("Burger", { exact: true }).fill("Bacon Smash");
await page.getByLabel("Location").fill("Long Beach, CA");
await page.getByLabel("Price").fill("15");

// Real file through the real input — exercises compressImage + object URL.
await page.locator('input[type="file"]').setInputFiles("./public/pwa-512.png");
await page.waitForTimeout(700);
check("preview visible", await page.locator(".photo-wrap img.photo").isVisible(), "true");
const src = await page.locator(".photo-wrap img.photo").getAttribute("src");
check("preview is a blob URL", src?.startsWith("blob:"), "true");
await page.screenshot({ path: `${SHOTS}/10-dark-add-photo.png` });

// Removing then re-adding must not leave a dead preview behind.
await page.getByLabel("Remove photo").click();
await page.waitForTimeout(200);
check("picker returns after remove", await page.locator(".photo-picker").isVisible(), "true");
await page.locator('input[type="file"]').setInputFiles("./public/pwa-192.png");
await page.waitForTimeout(700);
check("preview visible again", await page.locator(".photo-wrap img.photo").isVisible(), "true");
check("re-added image actually decodes", await page.locator(".photo-wrap img.photo").evaluate((i) => i.naturalWidth > 0), "true");

await page.getByRole("button", { name: "Continue" }).click();
await page.getByPlaceholder("Add someone new").fill("Sam");
await page.getByRole("button", { name: "Add", exact: true }).click();
await page.waitForTimeout(250);
await page.getByRole("button", { name: "Rate with 1" }).click();

const rows = page.locator(".rating-row");
for (let i = 0; i < 5; i++) {
  await rows.nth(i).getByRole("radio", { name: "4.5 out of 5", exact: true }).click();
}
check("all-4.5 score", await page.locator(".live-score .score__value").innerText(), "9.0");
await page.getByRole("button", { name: "Save burger" }).click();

await page.waitForURL(/#\/burger\//);
await page.waitForTimeout(800);
check("photo persisted to detail", await page.locator("img.photo").evaluate((i) => i.naturalWidth > 0), "true");
check("detail score", await page.locator(".detail-hero .score__value").innerText(), "9.0");
await page.screenshot({ path: `${SHOTS}/11-dark-detail.png`, fullPage: true });

await page.getByRole("button", { name: /Leaderboard/ }).click();
await page.waitForTimeout(400);
await page.screenshot({ path: `${SHOTS}/12-dark-leaderboard.png` });

await browser.close();
console.log(fail.length ? `\n${fail.length} FAILED: ${fail.join(", ")}` : "\nAll photo + dark-mode checks passed.");
process.exit(fail.length ? 1 : 0);
