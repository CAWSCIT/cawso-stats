# Cloudflare Worker - Shopify Auth & GraphQL Proxy

This worker sits between the frontend app and Shopify. It handles two things:

1. **`/auth`** - Exchanges a Shopify `id_token` for an `access_token` (keeps the client secret out of the browser)
2. **`/graphql`** - Proxies GraphQL requests to the Shopify Admin API (attaches the access token server-side)

## Environment variables

These must be configured as secrets in the Cloudflare Worker:

- `SHOPIFY_CLIENT_ID` - The Shopify app's client ID
- `SHOPIFY_CLIENT_SECRET` - The Shopify app's client secret

## Endpoints

### POST `/auth`

Exchanges a Shopify `id_token` for an online access token.

**Request body:**

| Field      | Required | Description                          |
|------------|----------|--------------------------------------|
| `id_token` | Yes      | The JWT from Shopify's embed URL     |
| `shop`     | Yes      | The `.myshopify.com` domain          |

**JavaScript example:**

```js
const res = await fetch('https://throbbing-frog-a6d8.kalob-taulien.workers.dev/auth', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    id_token: 'eyJhbGci...',
    shop: 'your-store.myshopify.com',
  }),
});
const data = await res.json();
// Success: { shop: "your-store.myshopify.com", access_token: "shpat_xxxx" }
// Failure: { error: "Token exchange failed", details: { ... } }
```

### POST `/graphql`

Proxies a GraphQL query to the Shopify Admin API (`/admin/api/2025-01/graphql.json`).

**Request body:**

| Field          | Required | Description                                |
|----------------|----------|--------------------------------------------|
| `shop`         | Yes      | The `.myshopify.com` domain                |
| `access_token` | Yes      | The Shopify access token from `/auth`      |
| `query`        | Yes      | The GraphQL query or mutation string       |

**JavaScript example - start a bulk operation:**

```js
const res = await fetch('https://throbbing-frog-a6d8.kalob-taulien.workers.dev/graphql', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    shop: 'your-store.myshopify.com',
    access_token: 'shpat_xxxx',
    query: `mutation {
      bulkOperationRunQuery(
        query: """
        {
          products {
            edges {
              node {
                id
                title
              }
            }
          }
        }
        """
      ) {
        bulkOperation {
          id
          status
        }
        userErrors {
          field
          message
        }
      }
    }`,
  }),
});
const data = await res.json();
// data.data.bulkOperationRunQuery.bulkOperation.id
```

**JavaScript example - poll for bulk operation status:**

```js
const res = await fetch('https://throbbing-frog-a6d8.kalob-taulien.workers.dev/graphql', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    shop: 'your-store.myshopify.com',
    access_token: 'shpat_xxxx',
    query: `query {
      currentBulkOperation {
        id
        status
        url
      }
    }`,
  }),
});
const data = await res.json();
// When done: data.data.currentBulkOperation.status === "COMPLETED"
// The .url field contains the JSONL download link
```

## CORS

The worker allows all origins (`*`) and handles `OPTIONS` preflight requests.

## Deployment

Deploy via Wrangler or the Cloudflare dashboard. Make sure the environment secrets are set before deploying.
