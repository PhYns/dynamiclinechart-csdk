# Dynamic Line Chart — Sisense Compose SDK

A React demo of a line chart that **decides its own series**. Instead of hard-coding
which members to plot, it runs a query first to find out which ones actually have
data under the current filters — then draws only those.

Built with [Sisense Compose SDK](https://developer.sisense.com/guides/sdk/), React and Vite.

---

## What problem this solves

Break a chart down by a wide dimension — rooms, sites, brands, categories — and
you hit three things:

- **Per-member fan-out renders empty panels.** Query the dimension, render one
  chart per member, and every member with no data becomes a blank chart.
- **Sparse members look broken.** One data point out of twelve draws as a lone
  marker with no line attached.
- **Wide dimensions are unreadable.** Thirty legend entries, most near zero, all
  squashing the scale of the few that matter.

Worth being precise: Sisense post-filters, so a member with *no rows at all* never
reaches a single `breakBy` chart on its own. The empty-series problem appears the
moment you build the series list yourself — which is exactly what per-member
fan-out does.

## How it works

Two queries and one pure function:

```
                 ┌─────────────────────────────┐
  UNIVERSE  ───▶ │ dimensions: [Series]        │ ─▶ every member in the model
   query         └─────────────────────────────┘
                 ┌─────────────────────────────┐
  EVIDENCE  ───▶ │ dimensions: [Date, Series]  │ ─▶ period × member × measure,
   query         │ measures:   [Measure]       │    already post-filtered
                 │ filters:    dashboard       │
                 └─────────────────────────────┘
                              │
                              ▼   discoverSeries()   ← pure, no React, no SDK
             kept / dropped + a reason for each + peak values
                              │
                              ▼
        filterFactory.members(Series, kept)  ──▶  <LineChart breakBy={[Series]} />
```

`breakBy` is a **single attribute and never changes**. The number of lines is
decided entirely by the member filter. No `.map()` over series, no chart API.

A member is dropped for one of five reasons, each surfaced in the UI table:

| Reason | Rule |
|---|---|
| `no-data` | Exists in the model, returned no rows under the filters |
| `non-positive` | Returned rows, but the measure never rises above zero |
| `too-sparse` | Fewer than *N* periods carry a value |
| `below-share` | Contributes less than *X%* of the plottable total |
| `beyond-cap` | Real data, but outside the top *N* |

---

## Requirements

- **Node 20.19+ or 22.12+** (Vite requires `^20.19.0 || >=22.12.0`)
- A Sisense instance with a data source — this demo ships pointed at **Sample ECommerce**
- A Sisense user able to read that data source and call the REST API
- Admin access once, to add the CORS entry

## Setup

**1. Install**

```bash
git clone <this-repo>
cd <this-repo>
npm install
```

**2. Allow the browser through (do this first)**

Compose SDK calls your instance directly from the browser, so the origin must be
allow-listed or every request is silently dropped.

In Sisense: **Admin → Security Settings → CORS / Allowed Origins**, add
`http://localhost:5173` — `http` not `https`, no trailing slash — and make sure
CORS is enabled.

**3. Get an API token**

```bash
npx @sisense/sdk-cli@latest get-api-token \
  --url "https://<YOUR-SISENSE-HOST>" \
  -u "<YOUR-SISENSE-USER>"
```

Copy the token itself, **not** the word `Bearer` — the SDK adds that.

**4. Configure**

Create `.env.local` in the project root:

```ini
VITE_SISENSE_URL=https://<YOUR-SISENSE-HOST>
VITE_SISENSE_TOKEN=<YOUR-API-TOKEN>
VITE_SISENSE_DATASOURCE=Sample ECommerce
```

**5. Generate the data model**

```bash
npx @sisense/sdk-cli@latest get-data-model \
  --url "https://<YOUR-SISENSE-HOST>" \
  --token "<YOUR-API-TOKEN>" \
  -d "Sample ECommerce" \
  -o src/data/sample-ecommerce.ts
```

This produces a typed TypeScript wrapper around the cube's JAQL expressions, so
`DM.Commerce.Revenue` autocompletes and a renamed column becomes a compile error.

## Run

```bash
npm run dev        # http://localhost:5173
npx tsc -b         # type check - dev does NOT typecheck, run this first
npm run build      # production build
```

---

## Project structure

```
src/
├── lib/
│   ├── discovery.ts             the decision, as pure functions
│   └── palette.ts               series colours (8 validated slots)
├── hooks/
│   ├── useDynamicSeries.ts      the two queries
│   └── useStableSeriesColors.ts member → colour, sticky for the session
├── components/
│   └── DiscoveryTable.tsx       per-member decisions and reasons
├── data/sample-ecommerce.ts     generated - regenerate for your instance
├── App.tsx                      layout, controls, the charts
├── main.tsx                     SisenseContextProvider
└── env.ts                       environment plumbing
```

`src/lib/discovery.ts` has no React and no SDK imports beyond one type. That is
deliberate — the rules are testable in isolation and reusable server-side.

## Adapting to your own model

Everything model-specific lives in the constants at the top of `src/App.tsx`:

```tsx
const SERIES_OPTIONS = [
  { id: 'room', label: 'Room', attribute: DM.Location.Room },
  { id: 'site', label: 'Site', attribute: DM.Location.Site },
];

const TOTAL_REVENUE   = measureFactory.sum(DM.Sample.ColonyCount, 'Colony Count');
const DATE_LEVEL      = DM.Sample.Date.Months;
const DATE_RANGE_LEVEL = DM.Sample.Date.Years;
```

Regenerate the data model against your instance first, then fix whatever
TypeScript flags.

---

## Notes

- **`npm run dev` does not typecheck.** Vite strips types without running the
  checker, so a missing import reaches the browser as a runtime `ReferenceError`.
  Keep `npx tsc -b --watch` in a second terminal.
- **`filterFactory.members(attr, [])` does not mean "show nothing"** in Sisense.
  When discovery keeps nothing, the app renders an empty state instead.
- **Colours are sticky per member**, so adding a series does not repaint the
  survivors — which would otherwise read as "the data changed".
- **The series cap tops out at 8** because the palette has eight validated slots
  and never cycles them.

## Security

The API token is bundled into the browser at build time. **That is fine for a
local demo and wrong for anything shared or deployed** — anyone can read it in
devtools. For real embedding use a [Web Access Token](https://developer.sisense.com/guides/sdk/guides/authentication-security.html)
minted server-side (`wat` prop) or SSO (`ssoEnabled`), so each user's own data
permissions apply.

Before pushing: `.gitignore` covers `*.local`, so **`.env.local` is safe** — but
a plain **`.env` is not ignored**. Keep credentials in `.env.local` only, and
check with `git status` before your first commit.

## License

MIT