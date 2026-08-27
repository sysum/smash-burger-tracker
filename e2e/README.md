# Browser tests

Three end-to-end scripts that drive the built app in a real mobile-sized
Chromium and assert on what actually renders. They cover the parts unit tests
can't reach: that a score entered through the rating UI reaches the leaderboard
intact, that ranking behaves under every sort, and that a photo survives the
round trip through IndexedDB.

They are **not** part of `npm test` — they need a browser download, which is a
big dependency for a small app. Run them when changing the rating flow, the
leaderboard, or storage.

## Running

```bash
npm install --no-save playwright
npx playwright install chromium

npm run build
npm run preview &            # serves http://127.0.0.1:4173

node e2e/flow.mjs            # add reviewers → add burger → rate → verify 8.2
node e2e/sorting.mjs         # all four sorts, ranks, unrated handling
node e2e/photo.mjs           # photo capture + persistence, in dark mode
```

Each exits non-zero if any check fails, and writes screenshots to
`e2e/screenshots/`.

| Variable | Purpose |
| --- | --- |
| `E2E_BASE_URL` | Where the app is served (default `http://127.0.0.1:4173`) |
| `E2E_SHOTS` | Screenshot output directory |
| `E2E_CHROMIUM` | Explicit Chromium path, if Playwright can't find one |

## What `flow.mjs` pins down

It walks the product spec's worked example through the real UI — two reviewers
scoring 76.5 and 87 — and asserts the leaderboard ends up showing **8.2**. If
the scoring maths, the averaging, or the 10-point rounding regresses, this
fails even if the unit tests somehow don't.
