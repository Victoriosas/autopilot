---
description: Deploy the platform to production
---

# Deploy Command

Deploy the Victoriosa Autopilot platform to production.

## Usage

```
/user: deploy [component] [environment]
```

## Arguments

- `component` - Component to deploy (frontend, backend, all)
- `environment` - Target environment (production, staging)

## Examples

```
/user: deploy frontend production
/user: deploy backend production
/user: deploy all production
```

## Frontend Deployment (Vercel)

1. Build React + Vite frontend
2. Deploy to Vercel
3. Configure environment variables
4. Set up custom domain

## Backend Deployment (Railway)

1. Build Express + TypeScript backend
2. Deploy to Railway
3. Configure environment variables
4. Set up database connections

## DNS Configuration

1. Configure victoriosa.click domain
2. Set up CNAME records
3. SSL certificate management
4. Subdomain configuration

## Environment Variables

### Frontend
```
VITE_API_URL=https://api.victoriosa.click
VITE_SUPABASE_URL=https://...
VITE_SUPABASE_ANON_KEY=...
```

### Backend
```
GROQ_API_KEY=sk_...
CJ_API_KEY=...
SUPABASE_URL=https://...
SUPABASE_SERVICE_ROLE_KEY=...
```
