# Resend Email Setup

## Overview
This app uses Resend to send email notifications when someone requests early access. When a user submits their email on the landing page, you'll receive an email notification at `niraj@hone.coffee`.

## Prerequisites
1. A Resend account (sign up at https://resend.com)
2. A verified domain (or use Resend's test domain for development)
3. Supabase project with access to environment variables

## Database Setup

### Run Migration
Before using the early access feature, you need to create the database table:

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Run the migration file: `supabase/migrations/002_create_early_access_requests.sql`

Or use the Supabase CLI:
```bash
supabase db push
```

This creates the `early_access_requests` table with:
- Email storage (primary key)
- Timestamp tracking
- Status field (pending/approved/rejected)

## Resend Setup

### 1. Get Your Resend API Key
- Log in to your Resend Dashboard
- Go to **API Keys** section
- Create a new API key
- Copy the API key (starts with `re_`)

### 2. Add Environment Variable in Supabase
Go to your Supabase project dashboard and add this secret:

```bash
RESEND_API_KEY=re_your_api_key_here
```

**Steps:**
1. Go to your Supabase project dashboard
2. Navigate to **Settings** → **Edge Functions** → **Secrets**
3. Add a new secret:
   - **Name**: `RESEND_API_KEY`
   - **Value**: Your Resend API key (e.g., `re_...`)

### 3. Domain Verification (Production)
For production, you'll need to verify your domain:
1. In Resend dashboard, go to **Domains**
2. Add your domain (e.g., `hone.coffee`)
3. Add the DNS records provided by Resend to your domain's DNS settings
4. Wait for verification (usually takes a few minutes)

### 4. Test Domain (Development)
For development/testing, Resend provides a test domain (`onboarding.resend.dev`) that works immediately without verification. The email will be sent from `noreply@onboarding.resend.dev` by default.

## How It Works

### Early Access Request Flow:
1. User enters email on landing page (`/`)
2. Frontend calls `/make-server-23508aac/early-access` endpoint
3. Backend stores email in `early_access_requests` database table
4. Backend sends email notification to `niraj@hone.coffee` (only for new requests)
5. User sees success message

### Database Storage
All early access requests are stored in the `early_access_requests` table with:
- `email` (primary key)
- `created_at` (timestamp)
- `status` (pending, approved, or rejected)

### Email Content
The email includes:
- User's email address
- Timestamp of the request

### Admin Endpoints
You can manage early access requests via these admin endpoints:
- `GET /make-server-23508aac/admin/early-access-requests` - List all requests
- `PUT /make-server-23508aac/admin/early-access-requests/:email` - Update status (pending/approved/rejected)
- `DELETE /make-server-23508aac/admin/early-access-requests/:email` - Delete a request

## Testing

To test the email functionality:
1. Make sure `RESEND_API_KEY` is set in Supabase Edge Functions secrets
2. Submit an email on the landing page
3. Check `niraj@hone.coffee` inbox for the notification

## Troubleshooting

### Email not received?
1. Check Supabase Edge Functions logs for errors
2. Verify `RESEND_API_KEY` is correctly set in Supabase secrets
3. Check Resend dashboard for email delivery status
4. Ensure your domain is verified (for production) or use test domain

### API Errors?
- Check Edge Functions logs in Supabase dashboard
- Verify the API key format (should start with `re_`)
- Ensure Resend account is active and not rate-limited
