import { createClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from './info';

/**
 * Use implicit flow to avoid PKCE code verifier storage issues on mobile Chrome.
 * PKCE stores the verifier in localStorage when the flow starts; on mobile,
 * OAuth may open in a different tab/context, so the verifier is lost on return.
 * Implicit flow puts tokens in the URL hash—no verifier needed.
 */
export const supabase = createClient(
  `https://${projectId}.supabase.co`,
  publicAnonKey,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      flowType: 'implicit',
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      storageKey: 'hone-auth',
    },
  }
);