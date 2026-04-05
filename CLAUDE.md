# CLAUDE.md - CAWSO Stats

## What this project is

Internal Shopify inventory dashboard for CAWSO (Cocaine Anonymous World Services). Built with React Router v7, Tailwind CSS v4, and TypeScript. Deployed to GitHub Pages at `https://cawscit.github.io/cawso-stats/`. Designed to run as an embedded Shopify app.

## Tech stack

- **Framework**: React Router v7 (SPA mode, `ssr: false`)
- **Styling**: Tailwind CSS v4 via Vite plugin
- **Build**: Vite 7, TypeScript 5.9
- **Auth proxy**: Cloudflare Worker (`cloudflare/worker.js`)
- **Deployment**: GitHub Pages via `peaceiris/actions-gh-pages`, build output is `build/client/`

## Project structure

```
app/
  root.tsx              - App shell, wraps all routes in ShopProvider
  shop-context.tsx      - Global React Context for shop + access_token auth
  app.css               - Tailwind import + print styles (12px font, white bg, 16px bold headings)
  routes.ts             - Route config: "/" (home) and "/inventory-report"
  routes/
    home.tsx            - Welcome page, shows auth status, nav link to inventory report
    inventory-report.tsx - Main feature: bulk operation flow, inventory table, CSV download
  data/                 - Local JSONL/JSON files for dev/testing
  welcome/              - Unused placeholder component from template
cloudflare/
  worker.js             - Auth + GraphQL proxy worker
.github/workflows/
  deploy.yml            - GitHub Pages deployment on push to main
```

## Authentication flow

Two modes:

1. **Embedded Shopify**: URL params (`id_token`, `shop`, etc.) are POSTed to `https://throbbing-frog-a6d8.kalob-taulien.workers.dev/auth` which exchanges the token with Shopify and returns `{ shop, access_token }`
2. **Local testing override**: Add `?access_token=xxx&shop=yyy` to the URL to skip the Cloudflare auth flow entirely

The `ShopProvider` in `root.tsx` handles both cases and exposes `useShopSession()` hook globally.

## Inventory report flow

When "Load Inventory Report" is clicked:

1. **Start bulk operation**: POST GraphQL mutation via Cloudflare worker (`/graphql` endpoint) to Shopify to kick off `bulkOperationRunQuery`
2. **Poll for completion**: Query `currentBulkOperation` with progressive backoff (5s, 10s, 15s, max 20s) until status is `COMPLETED`
3. **Fetch JSONL**: Download the JSONL file from the returned Google Cloud Storage URL
4. **Parse**: Walk the JSONL lines, linking records by `__parentId` to build product groups with variants, inventory levels, manufacturer, and reorder points
5. **Render**: Grouped tables with sticky headers, yellow highlight when US Shop available < reorder point

## Cloudflare Worker endpoints

- **POST `/auth`**: `{ id_token, shop }` -> exchanges for access token via Shopify OAuth
- **POST `/graphql`**: `{ shop, access_token, query }` -> proxies to `https://{shop}/admin/api/2025-01/graphql.json`
- Env secrets required: `SHOPIFY_CLIENT_ID`, `SHOPIFY_CLIENT_SECRET`

## Key decisions and conventions

- **Reorder point highlighting**: Always compares against the "US Shop" location's available quantity, not other warehouses (UK warehouse is coming online and would skew results)
- **Column display names differ from data**: "Committed" displays as "On Sales Order", "Manufacturer" displays as "Pref. Vendor"
- **CSV export**: Includes header row, flattens all variant/location combinations into rows, Column A is product title, reorder point repeated per location row
- **Print layout**: 12px font, no backgrounds/borders, product titles at 16px bold, column headers under each product, SKU column hidden in print, `print:ml-1.5` offset
- **Sticky headers**: Product title + column headers stick to top on scroll (cannot combine with horizontal scroll overflow — sticky was prioritized)
- **Production base path**: `/cawso-stats/` set in both `vite.config.ts` (`base`) and `react-router.config.ts` (`basename`)
- **No SSR**: This is a client-side only app (`ssr: false`), no server

## Commands

```bash
npm run dev        # Dev server at localhost:5173
npm run build      # Production build to build/client/
npm run typecheck  # Type generation + tsc
```
