# Frontend Production Setup

## Required Environment Variables

Set these in the frontend hosting provider before running the production build:

```env
NEXT_PUBLIC_API_URL=https://car-rental-avtw.onrender.com/api/v1
NEXT_PUBLIC_GOOGLE_CLIENT_ID=YOUR_GOOGLE_OAUTH_CLIENT_ID.apps.googleusercontent.com
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=YOUR_STRIPE_PUBLISHABLE_KEY
```

`NEXT_PUBLIC_API_URL` may include `/api/v1`. If it is omitted, the frontend appends `/api/v1` automatically.

Do not use backend secret values in frontend env vars. Stripe secret keys, webhook secrets, database URLs, JWT secrets, SMTP secrets, and Cloudinary secrets stay in the backend Render service.

## Axios API Configuration

The frontend axios client is configured in:

```text
frontend/lib/api.ts
```

It reads the base URL from:

```text
frontend/lib/env.ts
```

Production builds require `NEXT_PUBLIC_API_URL`. The frontend no longer falls back to a local backend URL, which prevents deployed browsers from calling an unavailable machine-local service.

## Google OAuth Configuration

In Google Cloud Console, update the OAuth 2.0 Web Client:

```text
Authorized JavaScript origins:
https://YOUR_FRONTEND_DOMAIN
```

For preview deployments, add each preview origin you intend to test.

No backend URL is needed as an authorized JavaScript origin for the browser Google login button. The frontend receives the Google credential and sends it to:

```text
POST https://YOUR_RENDER_BACKEND_URL.onrender.com/api/v1/auth/google
```

The backend must have the matching `GOOGLE_CLIENT_ID` in Render.

## Render Backend CORS

Set this in the Render backend service:

```env
CLIENT_URL=https://YOUR_FRONTEND_DOMAIN
```

The value must be the exact frontend origin, without a trailing slash.

## Stripe Configuration

Frontend:

```env
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

Backend Render service:

```env
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

Stripe webhook endpoint:

```text
https://YOUR_RENDER_BACKEND_URL.onrender.com/api/v1/payments/webhook
```

Keep webhook handling on the backend only.

## Deployment Checklist

1. Set frontend `NEXT_PUBLIC_API_URL` to the deployed Render backend API URL.
2. Set frontend `NEXT_PUBLIC_GOOGLE_CLIENT_ID`.
3. Set frontend `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
4. Set backend Render `CLIENT_URL` to the frontend production origin.
5. Add the frontend origin to Google OAuth authorized JavaScript origins.
6. Rebuild and redeploy the frontend after changing any `NEXT_PUBLIC_*` variable.
7. Verify:

```bash
curl https://car-rental-avtw.onrender.com/health
curl https://car-rental-avtw.onrender.com/api/v1/cars
```
