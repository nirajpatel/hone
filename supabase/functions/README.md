# Supabase Edge Functions

This directory contains the server-side functions that run on Supabase Edge Functions.

## Structure

```
supabase/functions/
├── make-server-23508aac/
│   ├── index.ts                      # Main API server (Hono)
│   ├── kv_store.ts                   # Key-value store operations
│   ├── brewMethods.ts                # Brew method configurations
│   ├── lamarzocco.ts                 # La Marzocco integration
│   ├── notifications.ts              # SMS notification handlers
│   └── migrate-extraction-to-brew.ts # Database migration script
├── auth-hook/
│   └── index.ts                      # Before User Created hook
└── send-email-hook/
    └── index.ts                      # Custom email hook for magic links
```

## Deployment

Deploy main API server:
```bash
npx supabase functions deploy make-server-23508aac --project-ref YOUR_PROJECT_REF
```

Deploy auth hook:
```bash
npx supabase functions deploy auth-hook --project-ref YOUR_PROJECT_REF
```

Deploy send email hook:
```bash
npx supabase functions deploy send-email-hook --project-ref YOUR_PROJECT_REF
```

Or use the deployment script:
```bash
./deploy-send-email-hook.sh
```

**Note:** See `SEND_EMAIL_HOOK_DEPLOYMENT.md` for complete setup instructions for the send-email-hook function.

## Development

Edit the files directly in this directory. Changes will be deployed on the next deployment.

## API Endpoints

All endpoints are prefixed with `/make-server-23508aac/`:

- **Brews**: GET/POST/PUT/DELETE `/brews`
- **Coffees**: GET/POST/PUT/DELETE `/coffees`
- **Users**: GET `/users`
- **Equipment**: GET/POST/PUT/DELETE `/equipment`
- **Notifications**: POST `/notifications/*`
- **Migration**: POST `/migrate-extraction-to-brew`
- **Cleanup**: POST `/cleanup-old-extractions`
- **Version**: GET `/version`

## Brew Suggestions (AI Guidance)

The system automatically generates AI-powered brew suggestions to help improve coffee extraction quality.

### When Suggestions Are Generated

- **On brew creation**: If a brew has quality rating or notes, suggestions are generated (only for the newest brew per coffee)
- **On brew update**: If quality rating or notes are added/changed, suggestions are regenerated (only for the newest brew per coffee)
- **On removal**: If both quality rating and notes are removed, suggestions are cleared from the brew

### Requirements

- Suggestions are only generated for the **newest brew** for each coffee (by creation date)
- The brew must have at least one of: quality rating, tasting notes, or personal notes
- Suggestions can be generated even with just a single brew (no historical brew data required)
- The AI uses brew parameters, coffee characteristics, and general brewing knowledge to provide suggestions

### Suggestion Format

Each brew can have a `suggestion` object containing:
- **concise**: Short-form suggestion with goal, action, and confidence level
- **full**: Detailed analysis with summary, primary issue, and multiple parameter-specific suggestions

## Notes

- Functions use Deno runtime
- TypeScript files (.ts) are automatically transpiled
- Environment variables are managed through Supabase dashboard
