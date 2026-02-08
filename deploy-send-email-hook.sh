#!/bin/bash

# Deploy Send Email Hook Edge Function
# Make sure you're logged in: npx supabase login
# 
# Note: JWT verification is disabled via:
# 1. supabase/config.toml (verify_jwt = false)
# 2. --no-verify-jwt flag in deployment command
# Make sure config.toml is committed to git to persist this setting

set -e

echo "🚀 Deploying send-email-hook Edge Function..."

npx supabase functions deploy send-email-hook --project-ref YOUR_PROJECT_REF --no-verify-jwt

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Next steps:"
echo "1. Go to Supabase Dashboard → Settings → Edge Functions → Secrets"
echo "2. Add SEND_EMAIL_HOOK_SECRET (generate with: openssl rand -hex 32)"
echo "3. Go to Supabase Dashboard → Authentication → Hooks"
echo "4. Configure Send Email Hook URL: https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-email-hook"
echo "5. Enable the hook"
echo ""
echo "See SEND_EMAIL_HOOK_DEPLOYMENT.md for detailed instructions."
