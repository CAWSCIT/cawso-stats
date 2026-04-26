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
          `https://${shop}/admin/api/2026-04/graphql.json`,
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

      if (path === '/send-test-email') {
        const resendRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'no-reply@email.ca-connect.org',
            to: 'dal04@ca.org',
            subject: 'CAWSO Stats test email',
            html: '<p>Test email sent to dal04@ca.org</p>',
          }),
        });

        const data = await resendRes.json();

        return new Response(JSON.stringify(data), {
          status: resendRes.status,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // POST /send-manufacturer-email - email manufacturer with order details
      if (path === '/send-manufacturer-email') {
        const body = await request.json();
        const { orderName, items, shippingName, shippingAddress } = body;

        if (!orderName || !Array.isArray(items) || items.length === 0) {
          return new Response(
            JSON.stringify({ error: 'orderName and items are required' }),
            {
              status: 400,
              headers: { 'Content-Type': 'application/json', ...corsHeaders },
            }
          );
        }

        const escapeHtml = (s) =>
          String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');

        const itemsHtml = items
          .map((item) => {
            const name = escapeHtml(item.name);
            const qty = escapeHtml(item.quantity);
            const sku = item.sku ? ` (SKU: ${escapeHtml(item.sku)})` : '';
            return `<li>${qty} × ${name}${sku}</li>`;
          })
          .join('');

        const addressLines = Array.isArray(shippingAddress)
          ? shippingAddress
          : [];
        const addressHtml = [shippingName, ...addressLines]
          .filter(Boolean)
          .map((line) => escapeHtml(line))
          .join('<br />');

        const html = `
          <p>Hello,</p>
          <p>Hope you're doing well. We have a new specialty medallion order from CAWSO (${escapeHtml(
            orderName
          )}) that needs to be drop shipped to the customer below.</p>
          <p><strong>Items:</strong></p>
          <ul>${itemsHtml}</ul>
          <p><strong>Ship to:</strong><br />${addressHtml || '(no shipping address on file)'}</p>
          <p>Thank you!</p>
          <p style="color:#555;font-size:12px;">The assistant manager of CAWSO has CC'd. For questions or clarification, please call them.</p>
        `;

        const resendRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'no-reply@email.ca-connect.org',
            to: [`${env.SPECIALTY_MANUFACTURER_EMAIL}`],
            cc: ['ast.mgr@ca.org'],
            bcc: ['dal04@ca.org'],
            reply_to: 'ast.mgr@ca.org',
            subject: 'Specialty Medallion Order from CAWSO',
            html,
          }),
        });

        const data = await resendRes.json();

        return new Response(JSON.stringify(data), {
          status: resendRes.status,
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
