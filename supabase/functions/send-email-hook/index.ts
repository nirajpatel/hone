import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";
import { Resend } from "npm:resend";

// Disable JWT verification - Supabase calls hooks internally
export const config = { auth: false };

const resend = new Resend(Deno.env.get("RESEND_API_KEY") as string);
const hookSecret = (Deno.env.get("SEND_EMAIL_HOOK_SECRET") as string)?.replace("v1,whsec_", "") || null;
const projectRef = Deno.env.get('SUPABASE_PROJECT_REF') || 'YOUR_PROJECT_REF';
const supabaseUrl = Deno.env.get('SUPABASE_URL') || `https://${projectRef}.supabase.co`;

Deno.serve(async (req) => {
  console.log('=== Send Email Hook Called ===');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  
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
    console.log('GET request - health check');
    console.log('RESEND_API_KEY configured:', !!Deno.env.get('RESEND_API_KEY'));
    console.log('SEND_EMAIL_HOOK_SECRET configured:', !!Deno.env.get('SEND_EMAIL_HOOK_SECRET'));
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
  
  console.log('Request headers:', JSON.stringify(headers, null, 2));
  console.log('Payload length:', payload.length);
  console.log('SEND_EMAIL_HOOK_SECRET present:', !!Deno.env.get('SEND_EMAIL_HOOK_SECRET'));
  console.log('hookSecret extracted:', !!hookSecret);
  if (hookSecret) {
    console.log('hookSecret length:', hookSecret.length);
    console.log('hookSecret starts with:', hookSecret.substring(0, 10) + '...');
  }

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
      console.log('Attempting webhook signature verification...');
      const wh = new Webhook(hookSecret);
      verifiedData = wh.verify(payload, headers) as typeof verifiedData;
      console.log('Webhook signature verification SUCCESS');
      console.log('Verified user email:', verifiedData.user?.email);
      console.log('Verified email_action_type:', verifiedData.email_data?.email_action_type);
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
    console.log('Parsing payload without verification...');
    verifiedData = JSON.parse(payload);
    console.log('Parsed payload - user email:', verifiedData.user?.email);
    console.log('Parsed payload - email_action_type:', verifiedData.email_data?.email_action_type);
  }

  const { user, email_data } = verifiedData;

  console.log('=== Processing Email ===');
  console.log('User email:', user?.email);
  console.log('Email action type:', email_data?.email_action_type);
  console.log('Token present:', !!email_data?.token);
  console.log('Token hash present:', !!email_data?.token_hash);
  console.log('Redirect to:', email_data?.redirect_to);
  console.log('Site URL:', email_data?.site_url);
  console.log('Full email_data:', JSON.stringify(email_data, null, 2));

  // Only handle magic link emails
  if (email_data.email_action_type !== 'magic_link' && email_data.email_action_type !== 'magiclink') {
    console.log(`Skipping email type: ${email_data.email_action_type}`);
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
  console.log('Magic link URL constructed:', magicLinkUrl);
  console.log('App URL (extracted from redirect_to):', appUrl);
  console.log('Redirect to:', redirectTo);
  console.log('Token hash (first 50 chars):', tokenHash?.substring(0, 50) + '...');

  try {
    console.log('=== Sending Email via Resend ===');
    console.log('Resend API Key present:', !!Deno.env.get('RESEND_API_KEY'));
    console.log('Template ID: magic-link-email');
    console.log('To:', user.email);
    console.log('From: Hone <noreply@hone.coffee>');
    
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

    console.log('=== Email Sent Successfully ===');
    console.log('Resend response data:', JSON.stringify(data, null, 2));
    console.log(`Magic link email sent successfully to ${user.email}`);
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
