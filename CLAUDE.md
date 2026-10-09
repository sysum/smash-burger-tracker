# Smash Burger Tracker — Claude Context

A mobile-first PWA for logging, scoring, and ranking smash burgers. Used on a
phone in restaurants. **Public read, private write:** anyone with the URL sees
the leaderboard; only signed-in crew can add or change anything.

Live at <https://smash-burger-tracker.vercel.app>, backed by Supabase project
`ifaaoxnozcbmlcwofees`.

**Read `README.md` too** — it covers the same ground for humans, with setup and
deployment. This file is the short version plus the things that are easy to
break.

---

## Stack

| Layer | Choice |
| :---- | :----- |
| Framework | React 19 + TypeScript, Vite 7 |
| Routing | react-router-dom 7, **HashRouter** |
| Backend | Supabase (Postgres + Auth + Storage) — optional; absent = local only |
| Storage | Supabase when configured, else IndexedDB via `idb-keyval` |
| Auth | Supabase email OTP (six-digit code, **not** magic link) |
| PWA | `vite-plugin-pwa` (autoUpdate service worker) |
| Styling | Plain CSS with custom properties — no Tailwind, no CSS-in-JS |
| Tests | Vitest (unit) + Playwright scripts (`e2e/`, not in `npm test`) |

No state library, no data-fetching library, no component library. There is
nothing to fetch and the app is small enough that React state is sufficient.

## Commands

```bash
npm run dev          # Vite dev server, http://localhost:5173
npm run dev -- --host  # expose on LAN for phone testing
npm test             # Vitest, ~60 tests, sub-second
npm run typecheck    # tsc --noEmit
npm run lint         # ESLint
npm run gen:types    # regenerate src/lib/database.types.ts from the remote schema
npm run build        # typecheck + production build to dist/ (uses .env.local)
npm run build:e2e    # same, but forced to local storage (--mode e2e)
npm run test:e2e     # builds local-mode first, then drives a real browser
                     # needs: npm i --no-save playwright && npx playwright install chromium
                     # serve with: npm run preview -- --host 127.0.0.1
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
│   ├── repository.ts        The single persistence boundary + backend choice
│   ├── supabaseRepository.ts Postgres/Storage implementation of Repository
│   ├── supabase.ts          Client singleton; null when unconfigured
│   ├── database.types.ts    GENERATED from the remote schema — do not hand-edit
│   ├── mutations.ts         Every change to the dataset, as pure transforms
│   ├── photos.ts            Downscale + re-encode before storing
│   ├── format.ts            Date, price, number formatting
│   └── id.ts                Id generation
├── store/
│   ├── AppStore.tsx         React state over the repository
│   └── AuthStore.tsx        Who is signed in; `canWrite`
├── components/              Presentational pieces + RequireWriteAccess
├── screens/                 Leaderboard, BurgerDetail, AddBurger, Reviewers, SignIn
└── styles/                  tokens.css (all colours) + global.css

supabase/migrations/         Schema, RLS, grants, add_visit RPC
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

**`Repository` has one method per user-visible change**, not a single
`save(wholeDataset)`. Both work against local storage; only this shape works
against a network backend, where a whole-dataset write means rewriting every
row on every edit and lets two devices silently overwrite each other. Adding a
new kind of change means adding a method here and a pure transform in
`lib/mutations.ts` — not widening `save`.

**`lib/mutations.ts` is the shared definition of what each change means.** The
store applies a transform to React state; the repository applies the same one
to storage. A rule implemented in only one of them — "deleting a reviewer also
deletes their scorecards" — would hold in memory and quietly not hold on disk,
and you would only see it after a reload. Tested in `mutations.test.ts`.

**Writes are awaited, and their failure reaches the caller.** Store actions
persist first and update React state second, so the two can never disagree and
a screen can tell the user their burger did not save. Do not go back to
updating state and letting an effect write in the background: the write then
fails after the screen has navigated away, leaving a console error behind a
burger that looks saved and isn't.

**Clear an input before awaiting a write, never after.** Anything the user
types while the write is in flight is otherwise wiped when the handler
resumes — milliseconds against IndexedDB, but plainly visible over a network.
`handleQuickAdd` in `AddBurger.tsx` and `handleAdd` in `Reviewers.tsx` both do
this; `e2e/flow.mjs` catches it if they stop.

**`database.types.ts` is generated, never hand-edited.** Run `npm run gen:types`
after any migration. The Supabase client is typed against it, so a renamed
column breaks the build at the call site instead of returning undefined at
runtime. The three row interfaces this replaced were hand-maintained and had
exactly the drift problem a stored score would have.

Migrations are applied with `supabase db push`, not by pasting into the
dashboard SQL editor — the remote `schema_migrations` table is then an accurate
record of what ran, so `supabase migration list` can be trusted. If something
is ever applied by hand, reconcile it with
`supabase migration repair --status applied <version>` and verify the schema
first; marking an unverified migration as applied bakes the divergence in
permanently.

**A deployed build with no Supabase configuration refuses to start.** Falling
back to local storage is correct for `npm run dev` and for the browser tests,
and wrong on a host: the app renders as a complete, convincing copy of itself
with no sign-in and every visitor writing into their own browser, and nothing
looks broken. `VITE_LOCAL_ONLY=true` is how local-only is asked for on purpose
(`.env.e2e` sets it). Do not make the fallback silent again.

Both variables must also be set **in the host**, not just in `.env.local` —
Vite inlines them at build time, so a deploy without them needs a redeploy
after they are added, not just a restart.

**Row level security is the only thing protecting the data.** The publishable
key is inlined into the JavaScript bundle by Vite and is public by design; it
grants nothing on its own. ("Publishable" is the current name for the key
Supabase used to call `anon`. The Postgres *role* is still called `anon` and is
unchanged — that is what the policies target. The key was renamed, the role was
not.) Every table must have RLS enabled and a policy, and every
table also needs an explicit GRANT — the project is configured with
"automatically expose new tables" off, so the two are independent gates and
both must pass. A `service_role` key must never appear in a `VITE_` variable:
it bypasses RLS and would ship to every visitor as full write access.

**`canWrite` in `AuthStore` hides UI, it does not authorise.** The database
refuses an anonymous write whether or not a button renders. Never move an
authorisation decision into React — a gate you can read in devtools is not one.

**Sign-in is a six-digit emailed code, not a magic link.** A link needs a
redirect target, which from Capacitor's `capacitor://localhost` origin means a
custom URL scheme and a deep-link listener. A code has no redirect and works
identically on web and native. This depends on the dashboard's Magic Link email
template using `{{ .Token }}` rather than `{{ .ConfirmationURL }}` — change that
back and OTP sign-in silently becomes a link again.

**Sign-ups are disabled in the dashboard**, so having an account *is* the
allowlist that the RLS policies rely on. Turning sign-ups on would let anyone
who can read the leaderboard grant themselves write access.

Add crew with **Authentication → Users → Add user → Create new user** (auto
confirm). Not *Invite user*: an invite emails a `ConfirmationURL` that redirects
to Site URL and delivers real access and refresh tokens in a URL fragment. This
app has no callback to receive them (`detectSessionInUrl: false`, because
HashRouter owns the fragment), so the tokens go nowhere except into whatever
reads that URL.

**Several things live only in the Supabase dashboard** and cannot be rebuilt
from this repo: the `{{ .Token }}` email template, disabled sign-ups,
"automatically expose new tables" off, and "enable automatic RLS" on. Recreating
the project from `supabase/migrations/` alone gives a working database with
silently broken sign-in.

**The browser tests run against local storage, never the real project**
(`--mode e2e` blanks the Supabase variables). They exist to prove the app's own
logic; pointed at Supabase they would test the network and fail every write,
because they run as an anonymous visitor who by design cannot write.

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

No social features, no restaurant APIs, no maps, no AI, no achievements or
badges. Keep the architecture extensible for these; don't build them unasked.

Still to come, in order: a one-time upload of data already sitting in a phone's
IndexedDB (Phase 3), then offline write-through with soft deletes so a burger
can be logged with no signal (Phase 4), then the Capacitor wrap (Phase 5).
Until Phase 4 lands, a write with no connection fails — which is a real
regression against the local-only version, and the reason Phase 4 is not
optional.
