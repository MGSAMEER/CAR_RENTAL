# Render Deployment Troubleshooting

## Correct Render Setup

This repository is a monorepo:

```text
frontend/
backend/
```

Render must deploy the backend service only.

Use these Render Web Service settings:

```text
Repository: MGSAMEER/CAR_RENTAL
Branch: main
Root Directory: backend
Runtime: Node
Build Command: npm ci && npm run db:generate
Start Command: npm start
Health Check Path: /health
```

Do not use `cd backend` in the build or start commands when `Root Directory` is already set to `backend`.

## Why Render Could Not Find package.json

The error:

```text
/opt/render/project/src/package.json not found
```

means Render is running from the repository root. The root has `frontend/` and `backend/`, but no root-level `package.json`.

Fix:

```text
Root Directory: backend
```

Then Render resolves:

```text
/opt/render/project/src/backend/package.json
```

and runs commands from that directory.

## render.yaml Source of Truth

The repository `render.yaml` is configured for backend-only deployment:

```yaml
services:
  - type: web
    name: car-rental-backend
    runtime: node
    rootDir: backend
    buildCommand: npm ci && npm run db:generate
    startCommand: npm start
    healthCheckPath: /health
```

## Production Environment Variables

Keep production secrets in Render Dashboard or `sync: false` blueprint variables. Do not commit real secret values.

Required variables:

```text
NODE_ENV=production
PORT=5000
LOG_LEVEL=info
DATABASE_URL=<MongoDB Atlas connection string>
JWT_SECRET=<production secret>
JWT_REFRESH_SECRET=<production refresh secret>
CLIENT_URL=<frontend production URL>
STRIPE_SECRET_KEY=<Stripe live secret key>
STRIPE_WEBHOOK_SECRET=<Stripe webhook signing secret>
CLOUDINARY_CLOUD_NAME=<Cloudinary cloud name>
CLOUDINARY_API_KEY=<Cloudinary API key>
CLOUDINARY_API_SECRET=<Cloudinary API secret>
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=<Brevo SMTP user>
SMTP_PASS=<Brevo SMTP API key>
SMTP_FROM=<production sender>
GOOGLE_CLIENT_ID=<Google OAuth client ID>
```

## Stripe Webhook Preservation

The backend API version prefix is `/api/v1`.

Stripe webhook endpoint:

```text
https://<render-service>.onrender.com/api/v1/payments/webhook
```

Keep these Stripe events enabled:

```text
payment_intent.succeeded
payment_intent.payment_failed
charge.refunded
```

Webhook verification depends on `STRIPE_WEBHOOK_SECRET` and the raw request body. The backend already keeps the webhook route at `/api/v1/payments/webhook`; do not move it behind auth middleware.

## Quick Verification

After deployment:

```bash
curl https://<render-service>.onrender.com/health
curl https://<render-service>.onrender.com/api/v1/cars
```

Expected:

```text
/health returns service status
/api/v1/cars returns the versioned API response
```

## Common Failures

### package.json not found

Cause: Root Directory is empty or set to the repository root.

Fix:

```text
Root Directory: backend
Build Command: npm ci && npm run db:generate
Start Command: npm start
```

### build runs in backend/backend

Cause: Root Directory is `backend`, but commands still use `cd backend`.

Fix:

```text
Build Command: npm ci && npm run db:generate
Start Command: npm start
```

### Prisma client missing

Cause: `prisma generate` did not run during build.

Fix:

```text
Build Command: npm ci && npm run db:generate
```

### Stripe webhook signature verification fails

Check:

```text
STRIPE_WEBHOOK_SECRET matches the endpoint signing secret in Stripe
Webhook URL ends with /api/v1/payments/webhook
Stripe endpoint uses the Render backend URL, not the frontend URL
```

### CORS fails from frontend

Check:

```text
CLIENT_URL is the exact frontend origin
No trailing slash in CLIENT_URL
NODE_ENV=production
```
