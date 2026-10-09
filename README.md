# Smash Burger Tracker

A mobile-first web app for logging, scoring, and ranking smash burgers.

Add a burger, pick who's eating, tap out five category ratings per person, and
it lands on a ranked leaderboard. Works offline, installs to your home screen,
and stores everything on your device.

## Quick start

```bash
npm install
npm run dev          # http://localhost:5173
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | Typecheck, then production build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm test` | Run the test suite once |
| `npm run test:watch` | Tests in watch mode |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |

### Testing on your phone

```bash
npm run dev -- --host
```

Then open the printed network URL on your phone (same Wi-Fi). Note that iOS
only offers "Add to Home Screen" over HTTPS or on `localhost`, so the installed
PWA experience needs a deployed build rather than the LAN dev server.

## Scoring

Five weighted categories, each rated 1.0–5.0 in half-point steps:

| Category | Weight |
| --- | --- |
| Smash / Texture | 35% |
| Beef Flavor | 25% |
| Cheese & Toppings | 20% |
| Bun | 15% |
| Value | 5% |

One person's score, out of 100:

```
score = Σ (rating × weight) / 5
```

A burger's overall score is the mean of its reviewers' scores. Everything shown
to the user is on the 10-point scale (score ÷ 10, one decimal place).

Worked example — two reviewers:

```
Sam    4, 3.5, 4, 4, 3   →  76.5 / 100
Alex   4, 5,   4, 5, 3   →  87   / 100
                  average →  81.75 / 100  →  8.2 / 10
```

Two details in `src/lib/scoring.ts` that are load-bearing:

- **Multiply before dividing.** `(rating × weight) / 5`, not
  `(rating / 5) × weight`. The second form is inexact in binary floating point
  and turns the example above into `76.50000000000001`.
- **Epsilon-nudged rounding.** `81.75 / 10` is stored as `8.17499999…`, so a
  plain `Math.round` gives `8.1`. `roundTo` nudges by one epsilon first, so
  `.x5` boundaries round up the way people expect.

Both are covered by tests. If either regresses, the suite fails.

## Architecture

```
src/
├── types.ts                 Domain types
├── lib/
│   ├── scoring.ts           Weights + all score maths (pure)
│   ├── leaderboard.ts       Scoring visits + ranking rules (pure)
│   ├── repository.ts        The single persistence boundary
│   ├── mutations.ts         Every change to the dataset, as pure transforms
│   ├── photos.ts            Downscale + re-encode before storing
│   ├── format.ts            Date, price, and number formatting
│   └── id.ts                Id generation
├── store/AppStore.tsx       React state over the repository
├── components/              Presentational pieces
├── screens/                 Leaderboard, BurgerDetail, AddBurger, Reviewers
└── styles/                  Design tokens + global CSS
```

**Scoring and ranking are pure functions with no React or DOM imports.** That
is what makes them straightforward to test exhaustively, and it keeps the rules
in one place rather than scattered through components.

**All persistence goes through `Repository`.** Nothing above that interface
knows the data lives in IndexedDB. Swapping in a synced backend later means
writing one new implementation, not touching screens.

The interface exposes one method per user-visible change — add a reviewer,
delete a burger — rather than a single `save(wholeDataset)`. Both shapes work
against local storage, but only this one works against a server: a
whole-dataset write means rewriting every row on every edit, and two devices
editing at once overwrite each other wholesale because neither write says what
it changed.

Each change is defined once, as a pure transform in `lib/mutations.ts`. The
store applies it to React state and the repository applies it to storage, so
the two cannot drift. Store actions await the write and surface its failure,
which means a failed save reaches the user rather than a console.

### Data model

Three flat collections, related by id — the same shape as three SQL tables, so
moving to a real database later is a port rather than a redesign.

```
Reviewer     id, name, createdAt
BurgerVisit  id, restaurantName, burgerName, location, date,
             price, notes, photoId, createdAt
Rating       id, burgerVisitId, reviewerId,
             smashTexture, beefFlavor, cheeseToppings, bun, value
```

Scores are **not stored** — not per rating, not per burger. They are derived
from the raw category ratings on read. Storing them would let a saved number
drift out of sync with the ratings behind it if the weights were ever retuned,
and recomputing is a five-term sum.

### Storage

IndexedDB, via `idb-keyval`. The whole dataset is one JSON record; photos are
separate blobs keyed by `photoId`.

localStorage was the alternative and is the wrong fit: a ~5MB cap and
strings-only storage means photos would need base64 encoding (+33% size) and
would blow the quota within a few dozen burgers.

Photos are downscaled to 1600px and re-encoded as JPEG before being stored,
which takes a typical 3–12MB phone photo under ~300KB.

## Turning this into a native app

The app is built as a static SPA so it can be wrapped with
[Capacitor](https://capacitorjs.com/) without a rewrite — the native app runs
the same `dist/` build, so web and native cannot visually drift.

Three choices were made up front to keep that path open:

- **`base: "./"` in `vite.config.ts`** — relative asset paths work from
  Capacitor's local file origin as well as from a web host.
- **`HashRouter`, not `BrowserRouter`** — deep links need no server rewrite
  rules, which Capacitor's local origin cannot provide.
- **Device access sits behind small adapters** — photo capture is the only one
  so far (`<input type="file" capture>` in `AddBurger.tsx`). Swapping in
  Capacitor's Camera plugin touches that one call site.

When you're ready:

```bash
npm install @capacitor/core @capacitor/cli
npx cap init
npx cap add ios
npm run build && npx cap sync
```

## Deploying

Any static host. The build output in `dist/` is fully self-contained.

```bash
npm run build
```

For Vercel: framework preset "Vite", build command `npm run build`, output
directory `dist`. No environment variables or server are needed. `vercel.json`
sets cache headers only — the hashed files under `assets/` are cached
immutably, while `sw.js`, `registerSW.js`, `manifest.webmanifest`, and
`index.html` are served `must-revalidate`. That last part is load-bearing: with
`registerType: "autoUpdate"`, a cached service worker pins users to an old
build permanently.

There are no rewrite rules because `HashRouter` keeps every route at `/#/...`,
so the server only ever serves `/`. Switching to `BrowserRouter` would mean
adding a catch-all rewrite here — and would break the Capacitor path.

Deploying over HTTPS is also what makes the PWA real: iOS only offers "Add to
Home Screen" on a secure origin, never on a LAN dev server.

## Deliberately not included

No accounts, no sync, no social features, no restaurant lookup, no maps, no AI.
Data is local to the device — which means it does not sync between your phone
and laptop, and clearing site data clears your burgers.

Cross-device sync is the natural next step if you want it, and the repository
boundary is where it plugs in.
