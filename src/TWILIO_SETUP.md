# Twilio SMS Notification Setup

## Overview
This app uses Twilio to send SMS notifications to baristas requesting ratings for their extractions. Notifications are sent immediately when an extraction is logged (if it has no rating), with reminders every 15 minutes for up to 1 hour.

## Prerequisites
1. A Twilio account (sign up at https://www.twilio.com)
2. A Twilio phone number
3. Supabase project with access to environment variables

## Twilio Credentials Setup

### 1. Get Your Twilio Credentials
- Log in to your Twilio Console
- Find your **Account SID** and **Auth Token** on the dashboard
- Purchase or configure a Twilio phone number

### 2. Add Environment Variables in Supabase
Go to your Supabase project dashboard and add these secrets:

```bash
TWILIO_ACCOUNT_SID=your_account_sid_here
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+1234567890
```

### 3. Configure Twilio Webhook for SMS Responses
1. Go to Twilio Console > Phone Numbers > Manage > Active Numbers
2. Click on your Twilio phone number
3. Scroll to "Messaging"
4. Under "A MESSAGE COMES IN", select "Webhook"
5. Enter your webhook URL: `https://<your-project-id>.supabase.co/functions/v1/make-server-23508aac/sms-webhook`
6. Select "HTTP POST"
7. Save

## Setting Up the Reminder Cron Job

The system needs to check for pending reminders every minute. You have two options:

### Option 1: External Cron Service (Recommended)
Use a service like cron-job.org, EasyCron, or similar:

1. Create a new cron job that runs every minute
2. Set the URL to: `https://<your-project-id>.supabase.co/functions/v1/make-server-23508aac/check-reminders`
3. Set method to GET
4. No auth required (endpoint is public but safe)

### Option 2: Manual Testing
For testing, you can manually trigger the reminder check by visiting the URL in your browser:
```
https://<your-project-id>.supabase.co/functions/v1/make-server-23508aac/check-reminders
```

## How It Works

### Notification Flow:
1. **Extraction Created** → Immediate SMS sent (if no rating and user has phone number)
2. **15 minutes later** → First reminder SMS
3. **30 minutes later** → Second reminder SMS
4. **45 minutes later** → Third and final reminder SMS
5. **After 45 minutes** → Stop sending reminders for this extraction

### Queue Management:
- If multiple extractions are logged at once for the same user, they're processed one at a time
- After a user rates an extraction (via SMS or webapp), the system immediately asks about the next queued extraction
- If a user rates an extraction through the webapp, SMS notifications for that extraction are cancelled

### SMS Format:
**Initial message:**
```
Hey! How was your extraction of Onyx Coffee - Geometry Blend at 10:15 AM? Reply with 1 (Bad), 2 (Decent), or 3 (Exceptional)
```

**With ranking (multiple extractions of same coffee):**
```
Hey! How was your first extraction of Onyx Coffee - Geometry Blend at 10:15 AM? Reply with 1 (Bad), 2 (Decent), or 3 (Exceptional)
```

**Reminder:**
```
Reminder: Still curious about your extraction of Onyx Coffee - Geometry Blend at 10:15 AM! Reply 1, 2, or 3 to rate it.
```

**Final reminder (at 45 minutes):**
```
Final reminder: Still curious about your extraction of Onyx Coffee - Geometry Blend at 10:15 AM! Reply 1, 2, or 3 to rate it.
```

## User Profile Setup

Users can add their phone number through their profile:
1. Click their avatar in the top right
2. Select "Profile"
3. Add phone number (include country code, e.g., +1234567890)
4. Click "Save Changes"

⚠️ **Important**: Phone numbers must include the country code (e.g., +1 for US)

## Testing

1. Add your phone number to your user profile
2. Log an extraction without rating it
3. You should receive an SMS immediately
4. Reply with "1", "2", or "3" to rate
5. The extraction should update in the webapp

## Troubleshooting

### SMS Not Sending
- Check Twilio credentials are correct in Supabase secrets
- Verify phone number includes country code
- Check Twilio console for error logs

### Webhook Not Receiving Responses
- Verify webhook URL is correctly configured in Twilio
- Check Supabase function logs for errors
- Ensure webhook URL uses HTTPS

### Reminders Not Sending
- Ensure cron job is running every minute
- Check the `/check-reminders` endpoint returns `{"success":true}`
- Review server logs for errors

## Cost Considerations

- Twilio SMS costs vary by country (~$0.0075 per SMS in US)
- Each extraction can send up to 4 SMS (1 initial + 3 reminders)
- Consider implementing daily SMS limits if needed