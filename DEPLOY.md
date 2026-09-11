# Deployment Guide - Victoriosa Autopilot

## Architecture
- **Frontend**: Vercel (static React app)
- **Backend API**: Railway or Render (Node.js Express server)
- **Domain**: victoriosa.click → Vercel frontend

## Step 1: Deploy Backend to Railway

1. Go to https://railway.app
2. Sign in with GitHub
3. Click "New Project" → "Deploy from GitHub repo"
4. Select `Victoriosas/autopilot`
5. Railway will auto-detect Node.js
6. Add Environment Variables (see below)
7. Set Start Command: `npx tsx server.ts`
8. Deploy - you'll get a URL like `autopilot-production.up.railway.app`

## Step 2: Deploy Frontend to Vercel

1. Go to https://vercel.com
2. Sign in with GitHub
3. Click "Import Project" → Select `Victoriosas/autopilot`
4. Framework: Vite
5. Build Command: `vite build`
6. Output Directory: `dist`
7. Add Environment Variables (VITE_ prefixed)
8. Deploy

## Step 3: Connect Domain

1. In Vercel dashboard → Project Settings → Domains
2. Add `victoriosa.click`
3. Follow DNS instructions:
   - Add CNAME record: `victoriosa.click` → `cname.vercel-dns.com`
   - Or A record: `@` → `76.76.21.21`

## Environment Variables

Copy values from your local `.env.local` file.

### Vercel (Frontend)
```
VITE_SUPABASE_URL=<from .env.local>
VITE_SUPABASE_ANON_KEY=<from .env.local>
VITE_API_URL=https://YOUR_RAILWAY_URL
```

### Railway (Backend)
```
NODE_ENV=production
SUPABASE_URL=<from .env.local>
SUPABASE_ANON_KEY=<from .env.local>
SUPABASE_SERVICE_ROLE_KEY=<from .env.local>
CJ_API_KEY=<from .env.local>
GEMINI_API_KEY=<from .env.local>
PAYPAL_CLIENT_ID=<from .env.local>
PAYPAL_CLIENT_SECRET=<from .env.local>
PAYPAL_ENV=live
PAYPAL_CURRENCY=USD
EXCHANGE_RATE_EUR_USD=1.08
PORT=3000
```

All secret values are in your local `.env.local` file. Never commit secrets to git.
