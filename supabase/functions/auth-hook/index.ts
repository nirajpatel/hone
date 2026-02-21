import { corsHeaders } from '../_shared/cors.ts';

// Disable JWT verification - Supabase calls auth hooks internally
export const config = { auth: false };

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const payload = await req.json();

    // Extract email from various possible locations in the payload
    const email = payload.user?.email ||
                  payload.record?.email ||
                  payload.user?.user_metadata?.email ||
                  payload.user?.raw_user_meta_data?.email ||
                  payload.record?.user_metadata?.email ||
                  payload.record?.raw_user_meta_data?.email;

    if (!email) {
      // If no email, allow the request (shouldn't happen, but be safe)
      return new Response(JSON.stringify({}), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Allow all signups - no allowlist check
    return new Response(JSON.stringify({}), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in auth-hook:', error);
    // On error, allow the request to proceed (fail open for safety)
    return new Response(JSON.stringify({}), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
