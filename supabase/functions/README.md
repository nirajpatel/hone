# Supabase Edge Functions

This directory contains the server-side functions that run on Supabase Edge Functions.

## Structure

```
supabase/functions/
└── make-server-23508aac/
    ├── index.ts                      # Main API server (Hono)
    ├── kv_store.ts                   # Key-value store operations
    ├── brewMethods.ts                # Brew method configurations
    ├── lamarzocco.ts                 # La Marzocco integration
    ├── notifications.ts              # SMS notification handlers
    └── migrate-extraction-to-brew.ts # Database migration script
```

## Deployment

Deploy all functions:
```bash
npx supabase functions deploy make-server-23508aac --project-ref YOUR_PROJECT_REF
```

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

## Notes

- Functions use Deno runtime
- TypeScript files (.ts) are automatically transpiled
- Environment variables are managed through Supabase dashboard
