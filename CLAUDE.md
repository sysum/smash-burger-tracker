# Smash Burger Tracker — Claude Context

A mobile-first PWA for logging, scoring, and ranking smash burgers. Personal
app, used on a phone in restaurants. No accounts, no backend, no network.

**Read `README.md` too** — it covers the same ground for humans, with setup and
deployment. This file is the short version plus the things that are easy to
break.

---

## Stack

| Layer | Choice |
| :---- | :----- |
| Framework | React 19 + TypeScript, Vite 7 |
| Routing | react-router-dom 7, **HashRouter** |
| Storage | IndexedDB via `idb-keyval` |
| PWA | `vite-plugin-pwa` (autoUpdate service worker) |
| Styling | Plain CSS with custom properties — no Tailwind, no CSS-in-JS |
| Tests | Vitest (unit) + Playwright scripts (`e2e/`, not in `npm test`) |

No state library, no data-fetching library, no component library. There is
nothing to fetch and the app is small enough that React state is sufficient.

## Commands

```bash
npm run dev          # Vite dev server, http://localhost:5173
npm run dev -- --host  # expose on LAN for phone testing
npm test             # Vitest, ~50 tests, sub-second
npm run typecheck    # tsc --noEmit
npm run lint         # ESLint
npm run build        # typecheck + production build to dist/
npm run test:e2e     # needs: npm i --no-save playwright && npx playwright install chromium
```

Before committing: `npm test && npm run typecheck && npm run lint`.

---

## Structure

```
src/
├── types.ts                 Domain types
├── lib/
│   ├── scoring.ts           Weights + all score maths (PURE — no React/DOM)
│   ├── leaderboard.ts       Scoring visits + ranking rules (PURE)
│   ├── repository.ts        The single persistence boundary
│   ├── photos.ts            Downscale + re-encode before storing
│   ├── format.ts            Date, price, number formatting
│   └── id.ts                Id generation
├── store/AppStore.tsx       React state over the repository
├── components/              Presentational pieces
├── screens/                 Leaderboard, BurgerDetail, AddBurger, Reviewers
└── styles/                  tokens.css (all colours) + global.css
```

---

## Scoring — the part that must not regress

Five weighted categories, rated 1.0–5.0 in half-point steps. `CATEGORIES` in
`src/lib/scoring.ts` is the **single source of truth** — the rating UI, the
category breakdown, and the maths all iterate over it. Adding or reweighting a
category means editing that array and nothing else. Weights must total 100; the
module throws at import time if they don't.

| Category | Weight |
| :------- | -----: |
| Smash / Texture | 35% |
| Beef Flavor | 25% |
| Cheese & Toppings | 20% |
| Bun | 15% |
| Value | 5% |

```
score = Σ (rating × weight) / 5        → 0–100
displayed = score / 10, 1 decimal      → 0–10
```

### Two floating-point traps — do not "simplify" these

**1. Multiply before dividing.** `weightedScore` computes `(rating × weight) / 5`.
The algebraically identical `(rating / 5) × weight` is *not* identical in binary
floating point — `4/5` is inexact, and the reference example comes out as
`76.50000000000001` instead of `76.5`.

**2. `roundTo` nudges by `Number.EPSILON` before rounding.** `81.75 / 10` is
stored as `8.17499999…`, so a plain `Math.round(8.175 * 10) / 10` gives `8.1`
where `8.2` is correct. Without the nudge, *every* score ending in `.75` is
wrong on the leaderboard.

Both have named regression tests in `src/lib/scoring.test.ts`. If a change makes
those tests fail, the change is wrong — not the tests.

### Reference case (also walked end-to-end by `e2e/flow.mjs`)

```
Reviewer A   4, 3.5, 4, 4, 3   →  76.5 / 100
Reviewer B   4, 5,   4, 5, 3   →  87   / 100
                       average →  81.75 / 100  →  8.2 / 10
```

---

## Data model

Three flat collections related by id — the shape of three SQL tables, so moving
to a real database later is a port, not a redesign.

```ts
Reviewer     { id, name, createdAt }
BurgerVisit  { id, restaurantName, burgerName, location, date,
               price: number|null, notes, photoId: string|null, createdAt }
Rating       { id, burgerVisitId, reviewerId,
               smashTexture, beefFlavor, cheeseToppings, bun, value }
```

**Scores are never persisted** — not per rating, not per burger. They are
derived on read from the raw category ratings. A stored score can drift from the
ratings behind it if weights are ever retuned, and recomputing is a five-term
sum. Do not add a `calculatedScore` field.

`date` is a plain `YYYY-MM-DD` calendar date. Never parse it with
`new Date(iso)` — that reads it as UTC midnight and renders as the previous day
anywhere west of Greenwich. Use `formatDate` in `lib/format.ts`, which parses
field-by-field. There is a test for this.

---

## Invariants

**All persistence goes through `Repository`** (`src/lib/repository.ts`). No
screen, component, or store action may touch IndexedDB or `localStorage`
directly. Adding cross-device sync means writing a new implementation of that
interface and changing one line — not touching screens.

**`lib/scoring.ts` and `lib/leaderboard.ts` stay pure.** No React imports, no
DOM access. That is what makes them exhaustively testable.

**Unrated burgers sort last under both score orders**, and rank badges only
render when the list is actually ordered by score (`highest`/`lowest`). Under
"most recent" a `#1` badge would claim the top row is the best burger when it is
merely the newest. Covered by `leaderboard.test.ts` and `e2e/sorting.mjs`.

**Photos:** stored as Blobs keyed by `photoId`, separate from the JSON record,
downscaled to 1600px JPEG first (a raw phone photo is 3–12MB). Object URLs are
created and revoked in event handlers, not in effects keyed on the blob — the
effect version breaks under StrictMode's development remount and leaves the
preview pointing at a revoked URL.

**Colours come from `styles/tokens.css`.** No hardcoded hex values in
components. Light and dark are both defined there.

---

## Native app path (Capacitor)

The app is a static SPA so it can be wrapped with Capacitor and run the same
`dist/` output — web and native cannot visually drift. Three things preserve
that; changing any of them breaks the native path:

- **`base: "./"` in `vite.config.ts`** — relative asset paths work from
  Capacitor's local file origin as well as a web host.
- **`HashRouter`, not `BrowserRouter`** — deep links need no server rewrite
  rules, which Capacitor's origin cannot provide.
- **Device access behind adapters** — photo capture is the only one so far
  (`<input type="file" capture>` in `AddBurger.tsx`).

---

## Deliberately out of scope

No auth, no sync, no social features, no restaurant APIs, no maps, no AI, no
achievements or badges. Data is local to the device. Keep the architecture
extensible for these; don't build them unasked.
