# Hone

**Designed for better coffee.**

Track your brews, analyze patterns, and get AI-powered guidance to improve your coffee — every time.

[hone.coffee](https://hone.coffee)

---

## Features

- **Brew Logging** — Record grind size, dose, yield, time, and tasting notes for every brew
- **Coffee Library** — Manage your coffee collection with roaster details, origins, and processing methods
- **AI Brew Suggestions** — Get personalized guidance to dial in your next brew based on your history
- **Equipment Tracking** — Track grinders, brewers, and accessories
- **Household Sharing** — Share your coffee library and brews with your household
- **La Marzocco Integration** — Monitor and control La Marzocco Linea Mini machines (optional)
- **Coffee Bag Scanning** — Scan QR codes and extract coffee info from bag photos
- **Custom Magic Link Emails** — Branded passwordless authentication via Resend

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, Vite 6 |
| Styling | Tailwind CSS, Radix UI, Framer Motion |
| Backend | Supabase (Auth, Database, Storage, Edge Functions) |
| Edge Functions | Hono (Deno runtime) |
| AI | OpenAI API (brew suggestions) |
| Email | Resend (custom magic link emails) |
| Hosting | Vercel (frontend), Supabase (backend) |

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Supabase CLI](https://supabase.com/docs/guides/cli) (`npm install -g supabase`)
- A [Supabase](https://supabase.com) project
- A [Vercel](https://vercel.com) account (for deployment) or any static hosting

## Getting Started

### 1. Clone the repo

```bash
git clone https://github.com/<your-username>/hone-frontend.git
cd hone-frontend
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

```bash
cp .env.example .env
```

Edit `.env` and fill in your Supabase credentials:

```
VITE_SUPABASE_PROJECT_ID=your-project-ref
VITE_SUPABASE_ANON_KEY=your-anon-key
```

You can find these values in your **Supabase Dashboard → Settings → API**.

### 4. Set up Supabase

#### Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note your **project reference** (the subdomain in your project URL) and **anon key**

#### Run database migrations

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

This creates the required database tables (`allowed_emails`, `early_access_requests`, etc.).

#### Deploy Edge Functions

```bash
# Deploy the main API server
npx supabase functions deploy make-server-23508aac --project-ref <your-project-ref>

# Deploy the send-email-hook (optional, for custom magic link emails)
npx supabase functions deploy send-email-hook --project-ref <your-project-ref> --no-verify-jwt
```

#### Set Edge Function secrets

In your **Supabase Dashboard → Settings → Edge Functions → Secrets**, add:

| Secret | Required | Description |
|--------|----------|-------------|
| `OPENAI_API_KEY` | Yes | OpenAI API key for brew suggestions |
| `RESEND_API_KEY` | For custom emails | Resend API key |
| `SEND_EMAIL_HOOK_SECRET` | For custom emails | Generate with `openssl rand -base64 32`, prefix with `v1,whsec_` |
| `GOOGLE_API_KEY` | No | Google API key for additional AI features |
| `TWILIO_ACCOUNT_SID` | No | For SMS notifications |
| `TWILIO_AUTH_TOKEN` | No | For SMS notifications |
| `TWILIO_PHONE_NUMBER` | No | For SMS notifications |
| `LAMARZOCCO_INSTALLATION_KEY` | No | La Marzocco API integration |
| `LAMARZOCCO_USERNAME` | No | La Marzocco account |
| `LAMARZOCCO_PASSWORD` | No | La Marzocco account |

### 5. Start development server

```bash
npm run dev
```

The app will open at [http://localhost:3000](http://localhost:3000).

## Deploying to Vercel

### 1. Connect your repo

Import the project in the [Vercel dashboard](https://vercel.com/new) or use the CLI:

```bash
npm i -g vercel
vercel
```

### 2. Configure build settings

Vercel should auto-detect Vite. Verify these settings:

| Setting | Value |
|---------|-------|
| Framework Preset | Vite |
| Build Command | `npm run build` |
| Output Directory | `build` |

### 3. Add environment variables

In **Vercel → Project Settings → Environment Variables**, add:

```
VITE_SUPABASE_PROJECT_ID=your-project-ref
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Optionally, for La Marzocco feature gating:
```
VITE_LAMARZOCCO_ALLOWED_USER_ID=<uuid>
VITE_LAMARZOCCO_ALLOWED_HOUSEHOLD_ID=<uuid>
```

### 4. Configure Supabase auth redirect

In your **Supabase Dashboard → Authentication → URL Configuration**:

- **Site URL**: `https://your-app.vercel.app`
- **Redirect URLs**: Add `https://your-app.vercel.app/**`

This ensures magic links and OAuth redirects work correctly in production.

### 5. Deploy

```bash
vercel --prod
```

Or push to your connected Git branch for automatic deployments.

## Project Structure

```
├── src/
│   ├── components/       # React components
│   ├── utils/
│   │   └── supabase/     # Supabase client & config
│   ├── styles/           # Global CSS & Tailwind
│   ├── App.tsx           # Main app with routing
│   └── main.tsx          # Entry point
├── supabase/
│   ├── config.toml       # Supabase local config
│   ├── migrations/       # Database migrations
│   └── functions/        # Edge Functions (Deno)
│       ├── make-server-23508aac/  # Main API (Hono)
│       └── send-email-hook/       # Custom email hook
├── public/               # Static assets & PWA manifest
├── .env.example          # Environment variable template
├── vercel.json           # Vercel SPA rewrite config
└── vite.config.ts        # Vite build config
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server on port 3000 |
| `npm run build` | Build for production (outputs to `build/`) |
| `npm run generate-favicon` | Generate favicon assets |

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -m 'Add my feature'`)
4. Push to the branch (`git push origin feature/my-feature`)
5. Open a Pull Request

## License

MIT
