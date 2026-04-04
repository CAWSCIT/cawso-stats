# CAWSO Stats

Internal Shopify inventory dashboard for CAWSO. Built with React Router and Tailwind CSS, designed to run as an embedded Shopify app.

## What it does

- Authenticates with Shopify via a Cloudflare Worker token exchange (see `cloudflare/`)
- Fetches bulk inventory data (JSONL) from Shopify's bulk operation API
- Displays all products, variants, and inventory levels in a grouped table
- Highlights variants where available stock is below their reorder point
- Supports CSV export of the full inventory report
- Print-optimized layout for physical reports

## Getting started

```bash
npm install
npm run dev
```

App runs at `http://localhost:5173`.

### Local testing (without Shopify embed)

Add `access_token` and `shop` as URL params to skip the Cloudflare auth flow:

```
http://localhost:5173/?access_token=shpat_xxxxx&shop=your-store.myshopify.com
```

### Embedded in Shopify

When loaded inside Shopify Admin, the app reads the URL params (`id_token`, `shop`, etc.), POSTs them to the Cloudflare Worker, and receives an access token back.

## Project structure

```
app/
  root.tsx              # App shell, wraps routes in ShopProvider
  shop-context.tsx      # Global auth context (shop + access_token)
  routes/
    home.tsx            # Welcome page with auth status and navigation
    inventory-report.tsx # Inventory table, CSV download
  data/                 # Local data files (dev/testing)
cloudflare/
  worker.js            # Cloudflare Worker for Shopify token exchange
```

## Build

```bash
npm run build
```
