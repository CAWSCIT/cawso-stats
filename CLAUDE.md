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

1. **Embedded Shopify**: URL params (`id_token`, `shop`, etc.) are POSTed to `https://cawso-stats.dal04.workers.dev/auth` which exchanges the token with Shopify and returns `{ shop, access_token }`
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
- **Aggregating across all orders**: For "totals across all orders" reports (sum quantities, sum dollars, etc.), do not stop at `orders(first: 250)`. Walk the full `orders` connection with cursor pagination (`pageInfo { hasNextPage endCursor }` + `after:`), reduce each page in-memory as it arrives, and update a `setProgress({ pages, orders })` state so the UI shows live "scanned X orders across Y pages" progress while it runs. Keep a `MAX_ORDER_PAGES` safety cap. The canonical implementation lives in `app/collection-sales.tsx` (the `useCollectionSales` hook + `<CollectionSalesView>` body); routes that need a per-collection breakdown should reuse it rather than reimplementing the loop.
- **Collection breakdown caching**: `useCollectionSales` caches scanned totals in a module-level `Map<collectionGid, SalesTotals>` so navigating away and back is free, and visiting the same collection from two different routes (e.g. a dedicated route and the generic `/collection-breakdown/:id`) shares one scan.
- **Discount math (per line item)**: The collection breakdown computes `lineDiscount = (originalTotal − discountedTotal) + Σ discountAllocations.allocatedAmountSet` per line, attributing each line's slice of an order-level discount to that line's product. Verified against `totalDiscountsSet` on real CAWSO orders to the penny — Shopify itself distributes rounding pennies across lines so the slices sum exactly. **Caveat**: this is exact only when `discountAllocations` contains order-level allocations only. CAWSO currently runs automatic order-level discounts only ("5% off $200+", "10% off $500+"), so the formula is exact in practice. **Future hardening the user has flagged they may want**: if line-level (per-product) discounts are ever introduced, filter `discountAllocations` to allocations whose `discountApplication.targetType == ALL_LINE_ITEMS` (order-level only) and let `originalTotal − discountedTotal` carry the line-level part — that removes the double-count risk if Shopify ever lists a line-level allocation alongside an order-level one.

## Commands

```bash
npm run dev        # Dev server at localhost:5173
npm run build      # Production build to build/client/
npm run typecheck  # Type generation + tsc
```
