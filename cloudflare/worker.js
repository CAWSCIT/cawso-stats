export default {
  async fetch(request, env) {

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {

      // POST /auth - exchange id_token for access_token
      if (path === '/auth') {
        const body = await request.json();
        const { id_token, shop } = body;

        if (!id_token) {
          return new Response(JSON.stringify({ error: 'id_token is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        if (!shop) {
          return new Response(JSON.stringify({ error: 'shop is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        const params = new URLSearchParams({
          grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
          client_id: env.SHOPIFY_CLIENT_ID,
          client_secret: env.SHOPIFY_CLIENT_SECRET,
          subject_token_type: 'urn:ietf:params:oauth:token-type:id_token',
          requested_token_type: 'urn:shopify:params:oauth:token-type:online-access-token',
          subject_token: id_token,
        });

        const tokenRes = await fetch(
          `https://${shop}/admin/oauth/access_token?${params}`,
          { method: 'POST' }
        );

        const tokenData = await tokenRes.json();

        if (!tokenData.access_token) {
          return new Response(JSON.stringify({ error: 'Token exchange failed', details: tokenData }), {
            status: 401,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        return new Response(JSON.stringify({
          shop,
          access_token: tokenData.access_token,
        }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // POST /graphql - proxy GraphQL queries to Shopify
      if (path === '/graphql') {
        const body = await request.json();
        const { shop, access_token, query } = body;

        if (!shop || !access_token || !query) {
          return new Response(JSON.stringify({ error: 'shop, access_token, and query are required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        const shopifyRes = await fetch(
          `https://${shop}/admin/api/2025-01/graphql.json`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Shopify-Access-Token': access_token,
            },
            body: JSON.stringify({ query }),
          }
        );

        const data = await shopifyRes.json();

        return new Response(JSON.stringify(data), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }
  }
};
