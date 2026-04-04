# Cloudflare Worker - Shopify Token Exchange

This worker acts as a proxy between the embedded app and Shopify's OAuth token exchange endpoint. It exists so the Shopify client secret never touches the browser.

## How it works

1. The embedded app sends a POST request with the Shopify URL params (including `id_token` and `shop`)
2. The worker extracts `id_token` and `shop` from the JSON body
3. It performs a token exchange with Shopify's `/admin/oauth/access_token` endpoint using the stored `SHOPIFY_CLIENT_ID` and `SHOPIFY_CLIENT_SECRET`
4. On success, it returns `{ shop, access_token }` to the frontend
5. On failure, it returns an error object

## Environment variables

These must be configured as secrets in the Cloudflare Worker:

- `SHOPIFY_CLIENT_ID` - The Shopify app's client ID
- `SHOPIFY_CLIENT_SECRET` - The Shopify app's client secret

## Endpoint

**POST** `/`

### Request

```json
{
  "id_token": "eyJhbGci...",
  "shop": "your-store.myshopify.com"
}
```

### Success response

```json
{
  "shop": "your-store.myshopify.com",
  "access_token": "shpat_xxxx"
}
```

### Error response

```json
{
  "error": "Token exchange failed",
  "details": { ... }
}
```

## CORS

The worker allows all origins (`*`) for CORS, and handles `OPTIONS` preflight requests.

## Deployment

Deploy via Wrangler or the Cloudflare dashboard. Make sure the environment secrets are set before deploying.
