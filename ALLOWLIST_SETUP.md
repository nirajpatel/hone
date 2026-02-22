# Email Allowlist Setup Instructions

This document describes how to set up the email allowlist feature to restrict sign-ins to authorized users only.

## Prerequisites

- Supabase project with database access
- Supabase Edge Functions deployment access
- Admin access to Supabase Dashboard

## Step 1: Create Database Table and Migrate Existing Users

1. Go to Supabase Dashboard → SQL Editor
2. Run the migration script from `supabase/migrations/001_create_allowed_emails.sql`
   - This creates the `allowed_emails` table
   - This migrates all existing users from `auth.users` to the allowlist
   - Verify the migration worked by checking the `allowed_emails` table

## Step 2: Deploy Updated Backend Function

1. Deploy the updated `make-server-23508aac` function:
   ```bash
   npx supabase functions deploy make-server-23508aac --project-ref YOUR_PROJECT_REF
   ```

## Step 3: Test the Implementation

1. Try signing in with an email NOT in the allowlist - should be blocked
2. Try signing in with an email IN the allowlist - should work
3. Verify error messages display correctly on `/login` page
4. Test both Google OAuth and email/password sign-in methods

## Managing the Allowlist

### Via Admin Endpoints

The following endpoints are available for managing the allowlist (require authentication):

- `POST /make-server-23508aac/admin/allowed-emails` - Add email
  ```json
  {
    "email": "user@example.com",
    "created_by": "admin@example.com"
  }
  ```

- `DELETE /make-server-23508aac/admin/allowed-emails/:email` - Remove email

- `GET /make-server-23508aac/admin/allowed-emails` - List all emails

### Via SQL

You can also manage the allowlist directly in Supabase SQL Editor:

```sql
-- Add email
INSERT INTO allowed_emails (email, created_by)
VALUES ('user@example.com', 'admin');

-- Remove email
DELETE FROM allowed_emails WHERE email = 'user@example.com';

-- List all emails
SELECT * FROM allowed_emails ORDER BY created_at DESC;
```

## Migration Endpoint (Optional)

If you need to re-run the migration programmatically:

```bash
POST /make-server-23508aac/admin/migrate-existing-users
Authorization: Bearer YOUR_ACCESS_TOKEN
```

This will:
- Get all users from KV store
- Get all users from auth.users
- Add all unique emails to allowed_emails table

## Troubleshooting

### Existing users can't sign in
- Run the migration script again to ensure all users are in allowlist
- Check backend logs for 403 errors
- Verify the backend allowlist check is working

### Error messages not showing
- Verify SignInPage is handling OAuth redirect errors
- Check browser console for errors
- Ensure App.tsx is skipping error toasts on `/login` route

## Security Notes

- The allowlist check runs server-side and cannot be bypassed
- The backend check uses service role key (not exposed to client)
- Admin endpoints should be protected with proper authorization (TODO: add admin check)
- Error messages don't reveal sensitive information
