# Send Email Hook Deployment Guide

This guide walks you through deploying and configuring the `send-email-hook` Edge Function to intercept magic link emails and send them via Resend.

## Prerequisites

- Supabase CLI installed (`npx supabase` works)
- Access to Supabase Dashboard
- Resend API key (already configured as `RESEND_API_KEY`)

## Step 1: Authenticate with Supabase CLI

First, log in to Supabase CLI:

```bash
npx supabase login
```

This will open a browser window for authentication. After logging in, you'll be able to deploy functions.

## Step 2: Deploy the Edge Function

Deploy the `send-email-hook` function:

```bash
cd /Users/npatel/Documents/code/hone-frontend
npx supabase functions deploy send-email-hook --project-ref YOUR_PROJECT_REF
```

**Verification:**
- Go to Supabase Dashboard → Edge Functions
- Confirm `send-email-hook` appears in the list
- Check that it shows as "Active"

## Step 3: Add Environment Variables

The function requires these environment variables (secrets):

**Already configured:**
- `RESEND_API_KEY` - Already exists from previous Resend setup

**New secret to add:**
- `SEND_EMAIL_HOOK_SECRET` - A base64-encoded secret with `v1,whsec_` prefix used to verify webhook requests from Supabase

**Steps:**
1. Generate a base64-encoded secret:
   ```bash
   # Generate random bytes and encode to base64
   SECRET=$(openssl rand -base64 32)
   echo "v1,whsec_$SECRET"
   ```
   
   Or using Node.js:
   ```bash
   node -e "const crypto = require('crypto'); console.log('v1,whsec_' + crypto.randomBytes(32).toString('base64'))"
   ```

2. Go to Supabase Dashboard → Settings → Edge Functions → Secrets
3. Add a new secret:
   - **Name**: `SEND_EMAIL_HOOK_SECRET`
   - **Value**: The generated secret with `v1,whsec_` prefix (e.g., `v1,whsec_aBcDeFgHiJkLmNoPqRsTuVwXyZ1234567890==`)
   - Save the secret

**Optional (has defaults):**
- `SUPABASE_PROJECT_REF` - Defaults to `YOUR_PROJECT_REF`
- `SUPABASE_URL` - Defaults to `https://YOUR_PROJECT_REF.supabase.co`

## Step 4: Configure Send Email Hook in Supabase Dashboard

Configure Supabase to use the custom email hook:

1. Go to Supabase Dashboard → Authentication → Hooks
2. Find the "Send Email Hook" section
3. Click "Add Hook" or "Configure Hook"
4. Set the hook URL to:
   ```
   https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-email-hook
   ```
5. Enable the hook
6. Save the configuration

**Note:** Once enabled, Supabase will send all email webhook requests to this function. The function only handles `magic_link` emails and returns empty responses for other email types, allowing Supabase to handle them normally.

## Step 5: Test the Implementation

**Test magic link sign-in:**
1. Go to the sign-in page (`/login`)
2. Enter an email that's in the `allowed_emails` table or is an existing user
3. Click "Sign in with magic link"
4. Check the email inbox - should receive a custom-branded email from `Hone <noreply@hone.coffee>`
5. Click the magic link - should successfully sign in

**Verify logs:**
1. Go to Supabase Dashboard → Edge Functions → `send-email-hook` → Logs
2. Check for successful email sending logs: `"Sending magic link email to {email}"` and `"Magic link email sent successfully to {email}"`

**Test error handling:**
- If the function fails or returns an error, Supabase will send its default email as a fallback (the function returns empty 200 responses on errors)

## How It Works

1. User requests magic link sign-in on frontend
2. Frontend calls `/make-server-23508aac/validate-magic-link-email` to check eligibility
3. If eligible, frontend calls `supabase.auth.signInWithOtp()`
4. Supabase generates a magic link token and sends a webhook to `send-email-hook`
5. The function:
   - Verifies the webhook signature (if `SEND_EMAIL_HOOK_SECRET` is set)
   - Extracts email, token_hash, and redirect URL from payload
   - Constructs magic link URL: `https://YOUR_PROJECT_REF.supabase.co/auth/v1/verify?token_hash=...&type=magiclink&redirect_to=...`
   - Generates custom HTML email template
   - Sends email via Resend API
   - Returns empty 200 response to prevent Supabase from sending default email

## Troubleshooting

**Emails not being sent:**
- Check Edge Functions logs for errors
- Verify `RESEND_API_KEY` is set correctly
- Verify `SEND_EMAIL_HOOK_SECRET` is set (optional but recommended)
- Check Resend dashboard for email delivery status

**Default Supabase emails still being sent:**
- Verify the hook URL is correct in Dashboard
- Check that the hook is enabled
- Verify the function returns 200 status (check logs)

**Magic link not working:**
- Verify the magic link URL format matches Supabase's expected format
- Check that `token_hash` is correctly URL-encoded
- Verify `redirect_to` parameter is set correctly

## Files

- `supabase/functions/send-email-hook/index.ts` - The Edge Function code (already created, ready to deploy)
