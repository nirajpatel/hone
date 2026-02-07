import { createClient } from 'jsr:@supabase/supabase-js@2.49.8';
import { corsHeaders } from '../_shared/cors.ts';

// Get Supabase URL and service role key
const supabaseUrl = Deno.env.get('SUPABASE_URL') || `https://${Deno.env.get('SUPABASE_PROJECT_REF')}.supabase.co`;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!serviceRoleKey) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
}

const supabase = createClient(
  supabaseUrl,
  serviceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    
    // Extract email from the user object
    const email = payload.user?.email;
    
    if (!email) {
      // If no email, allow the request (shouldn't happen, but be safe)
      return new Response(JSON.stringify({}), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if email exists in allowed_emails table
    const { data, error } = await supabase
      .from('allowed_emails')
      .select('email')
      .eq('email', email)
      .maybeSingle();

    if (error) {
      console.error('Error checking allowed_emails:', error);
      // On error, allow the request to proceed (fail open for safety)
      return new Response(JSON.stringify({}), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!data) {
      // Email not found in allowlist - block signup
      return new Response(
        JSON.stringify({
          error: {
            http_code: 403,
            message: 'Thanks for your interest! This email isn't approved for beta access yet.',
          },
        }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Email found in allowlist - allow signup
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
