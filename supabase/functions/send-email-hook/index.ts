import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";
import { Resend } from "npm:resend";

// Disable JWT verification - Supabase calls hooks internally
export const config = { auth: false };

const resend = new Resend(Deno.env.get("RESEND_API_KEY") as string);
const hookSecret = (Deno.env.get("SEND_EMAIL_HOOK_SECRET") as string)?.replace("v1,whsec_", "") || null;
const projectRef = Deno.env.get('SUPABASE_PROJECT_REF') || 'YOUR_PROJECT_REF';
const supabaseUrl = Deno.env.get('SUPABASE_URL') || `https://${projectRef}.supabase.co`;

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      headers: { 
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      } 
    });
  }

  // Handle GET requests (health check / validation from Dashboard)
  if (req.method === 'GET') {
    return new Response(JSON.stringify({ status: 'ok', message: 'Send Email Hook is active' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (req.method !== 'POST') {
    return new Response('not allowed', { status: 400 });
  }

  const payload = await req.text();
  const headers = Object.fromEntries(req.headers);

  // Verify webhook signature if secret is configured
  let verifiedData: {
    user: { email: string };
    email_data: {
      token: string;
      token_hash: string;
      redirect_to: string;
      email_action_type: string;
      site_url: string;
      token_new?: string;
      token_hash_new?: string;
    };
  };

  if (hookSecret) {
    try {
      const wh = new Webhook(hookSecret);
      verifiedData = wh.verify(payload, headers) as typeof verifiedData;
    } catch (error: any) {
      console.error('=== Webhook signature verification FAILED ===');
      console.error('Error type:', error?.constructor?.name);
      console.error('Error message:', error?.message);
      console.error('Error code:', error?.code);
      console.error('Error stack:', error?.stack);
      console.error('Payload preview:', payload.substring(0, 200));
      console.error('Headers keys:', Object.keys(headers));
      console.error('Signature header present:', !!headers['svix-signature'] || !!headers['svix-id'] || !!headers['webhook-signature']);
      return new Response(
        JSON.stringify({
          error: {
            http_code: error.code || 401,
            message: error.message || 'Invalid webhook signature',
          },
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }
  } else {
    // If no secret configured, parse payload directly (for development/testing)
    console.warn('No webhook secret configured, skipping signature verification');
    verifiedData = JSON.parse(payload);
  }

  const { user, email_data } = verifiedData;

  // Handle magic link emails and signup emails (new users signing up via magic link)
  // Supabase sends 'signup' email_action_type for new user signups via magic link
  const isMagicLinkEmail = email_data.email_action_type === 'magic_link' || 
                          email_data.email_action_type === 'magiclink' ||
                          email_data.email_action_type === 'signup';
  
  if (!isMagicLinkEmail) {
    // Return empty JSON to let Supabase handle other email types
    return new Response(JSON.stringify({}), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // For PKCE flow, use /auth/confirm endpoint with token_hash parameter
  // Format: {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
  const tokenHash = email_data.token_hash;
  
  if (!tokenHash) {
    console.error('Missing token_hash in email_data (required for PKCE flow)');
    return new Response(JSON.stringify({}), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Extract app URL from redirect_to (which is set by frontend)
  // redirect_to is guaranteed to be the app URL (e.g., http://localhost:3000/login)
  // Extract origin from redirect_to to get the base app URL
  let appUrl = 'https://hone.coffee'; // fallback
  if (email_data.redirect_to) {
    try {
      const redirectUrl = new URL(email_data.redirect_to);
      appUrl = redirectUrl.origin; // e.g., http://localhost:3000 or https://hone.coffee
    } catch (e) {
      console.warn('Failed to parse redirect_to URL, using fallback:', e);
    }
  } else if (email_data.site_url) {
    // Fallback to site_url if redirect_to is not available
    // But check if it's a Supabase URL and skip it
    if (!email_data.site_url.includes('.supabase.co')) {
      appUrl = email_data.site_url;
    }
  }
  
  const redirectTo = email_data.redirect_to || appUrl + '/login';
  
  // Construct magic link URL: app_url/auth/confirm?token_hash=...&type=email
  const magicLinkUrl = `${appUrl}/auth/confirm?token_hash=${encodeURIComponent(tokenHash)}&type=email&redirect_to=${encodeURIComponent(redirectTo)}`;

  try {
    // Send email via Resend using template
    const { error, data } = await resend.emails.send({
      from: 'Hone <noreply@hone.coffee>',
      to: [user.email],
      template: {
        id: 'magic-link-email',
        variables: {
          magic_link: magicLinkUrl,
        },
      },
    });

    if (error) {
      console.error('=== Resend API Error ===');
      console.error('Error object:', JSON.stringify(error, null, 2));
      console.error('Error type:', error?.constructor?.name);
      // Return 200 with empty JSON so Supabase sends default email as fallback
      // This prevents blocking the auth request
      return new Response(JSON.stringify({}), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } catch (error: any) {
    console.error('=== Exception Sending Email ===');
    console.error('Error type:', error?.constructor?.name);
    console.error('Error message:', error?.message);
    console.error('Error stack:', error?.stack);
    console.error('Full error:', JSON.stringify(error, null, 2));
    // Return 200 with empty JSON so Supabase sends default email as fallback
    // This prevents blocking the auth request
    return new Response(JSON.stringify({}), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({}), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
