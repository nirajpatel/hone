# Send Email Hook - Quick Start Guide

## ✅ Step 1: Deploy Function (Ready to Execute)

The function code is ready. Run this command after authenticating:

```bash
# First, authenticate (if not already done):
npx supabase login

# Then deploy:
./deploy-send-email-hook.sh
```

Or manually:
```bash
npx supabase functions deploy send-email-hook --project-ref YOUR_PROJECT_REF
```

## 📋 Step 2: Add Secret (Manual Dashboard Step)

1. Generate a base64-encoded secret with prefix:
   ```bash
   SECRET=$(openssl rand -base64 32)
   echo "v1,whsec_$SECRET"
   ```
   Copy the output (should look like: `v1,whsec_aBcDeFgHiJkLmNoPqRsTuVwXyZ1234567890==`)

2. Go to: **Supabase Dashboard** → **Settings** → **Edge Functions** → **Secrets**
3. Click **"Add new secret"**
4. Enter:
   - **Name**: `SEND_EMAIL_HOOK_SECRET`
   - **Value**: Paste the generated secret with `v1,whsec_` prefix
5. Click **"Save"**

## ⚙️ Step 3: Configure Hook (Manual Dashboard Step)

1. Go to: **Supabase Dashboard** → **Authentication** → **Hooks**
2. Find **"Send Email Hook"** section
3. Click **"Add Hook"** or **"Configure Hook"**
4. Set **Hook URL** to:
   ```
   https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-email-hook
   ```
5. **Enable** the hook
6. Click **"Save"**

## 🧪 Step 4: Test

1. Go to `/login` page
2. Enter an eligible email (in `allowed_emails` table or existing user)
3. Click **"Sign in with magic link"**
4. Check email inbox for custom-branded email from `Hone <noreply@hone.coffee>`
5. Click the magic link to sign in

**Verify logs:**
- **Supabase Dashboard** → **Edge Functions** → **send-email-hook** → **Logs**
- Look for: `"Sending magic link email to {email}"` and `"Magic link email sent successfully"`

---

For detailed instructions, see `SEND_EMAIL_HOOK_DEPLOYMENT.md`
