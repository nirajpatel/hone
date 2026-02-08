# Configure Supabase SMTP with Resend

This guide shows how to configure Supabase to send authentication emails directly through Resend's SMTP instead of using the default Supabase email service.

## Prerequisites

1. A Resend account (sign up at https://resend.com)
2. A Resend API key
3. A verified domain in Resend (or use test domain for development)

## Step 1: Get Your Resend API Key

1. Log in to your Resend Dashboard
2. Go to **API Keys** section
3. Create a new API key (or use an existing one)
4. Copy the API key (starts with `re_`)

## Step 2: Verify Your Domain (Production)

For production, you need to verify your domain:

1. In Resend dashboard, go to **Domains**
2. Add your domain (e.g., `hone.coffee`)
3. Add the DNS records provided by Resend to your domain's DNS settings
4. Wait for verification (usually takes a few minutes)

**Note:** For development/testing, you can use Resend's test domain (`onboarding.resend.dev`) which works immediately without verification.

## Step 3: Configure SMTP in Supabase Dashboard

1. Go to your Supabase Dashboard
2. Navigate to **Authentication** → **SMTP Settings** (or **Project Settings** → **Authentication** → **SMTP**)
3. Toggle **"Enable Custom SMTP"** to ON
4. Fill in the SMTP settings:

   **SMTP Host:**
   ```
   smtp.resend.com
   ```

   **SMTP Port:**
   ```
   465
   ```

   **SMTP Username:**
   ```
   resend
   ```

   **SMTP Password:**
   ```
   YOUR_RESEND_API_KEY
   ```
   (Paste your Resend API key here, e.g., `re_...`)

   **Sender Email:**
   ```
   noreply@hone.coffee
   ```
   (Or use `noreply@onboarding.resend.dev` for testing)

   **Sender Name:**
   ```
   Hone
   ```

5. Click **"Save"** or **"Update"**

## Step 4: Test the Configuration

1. Go to your sign-in page (`/login`)
2. Enter an eligible email
3. Click **"Sign in with magic link"**
4. Check your email inbox - you should receive the magic link email from Resend

## SMTP Settings Summary

| Setting | Value |
|---------|-------|
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | Your Resend API key (`re_...`) |
| Sender Email | `noreply@hone.coffee` (or your verified domain) |
| Sender Name | `Hone` |

## Benefits of Using Resend SMTP

- ✅ No need for custom email hook
- ✅ Simpler setup - just configure SMTP settings
- ✅ Better deliverability than default Supabase emails
- ✅ Higher rate limits
- ✅ Production-ready

## Note

If you're currently using the `send-email-hook` approach, you can:
1. **Option A:** Keep using the hook (gives you more control over email templates)
2. **Option B:** Switch to SMTP (simpler, but uses Supabase's default email templates)

If you switch to SMTP, you can disable the Send Email Hook in **Authentication** → **Hooks**.
