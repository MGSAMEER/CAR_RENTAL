# 🚀 Render Deployment: Step-by-Step Checklist

**Complete deployment in 45-60 minutes**

---

## 📋 Phase 1: Pre-Deployment (10 minutes)

### Verify Code Readiness

- [ ] Clone repository:
  ```bash
  git clone https://github.com/MGSAMEER/CAR_RENTAL.git
  cd CAR_RENTAL
  ```

- [ ] Test locally:
  ```bash
  cd backend
  npm install
  npm start
  # Should see: "🚗 Car Rental API running on http://0.0.0.0:5000"
  ```

- [ ] Verify `.gitignore` has `.env`:
  ```bash
  cat .gitignore | grep .env
  # Should show: .env
  ```

- [ ] Ensure no secrets committed:
  ```bash
  git log -p | grep -i "sk_test_\|sk_live_\|xsmtpsib_\|password"
  # Should show nothing
  ```

### Prepare Accounts

Create accounts if not exists:
- [ ] Render: https://render.com
- [ ] MongoDB Atlas: https://www.mongodb.com/cloud/atlas
- [ ] Stripe (Production): https://stripe.com
- [ ] Cloudinary: https://cloudinary.com
- [ ] Brevo: https://www.brevo.com
- [ ] Google Cloud: https://console.cloud.google.com

---

## 🗄️ Phase 2: MongoDB Atlas Setup (10 minutes)

### Create Cluster

```
1. MongoDB Atlas Dashboard → Create Project → "car-rental-prod"
2. Build Database → Create (Free M5 Shared)
3. Region: eu-central-1 (or closest to users)
4. Click Create
5. Wait 5-10 minutes for cluster to be ready
```

### Configure Security

```
1. Network Access → Add IP Address
2. Option A (Production): 3.121.23.0/24 (Render EU)
3. Option B (Dev): 0.0.0.0/0 (Allow all)
4. Click Confirm

5. Database Access → Add Database User
   Username: car_rental_prod_user
   Password: Generate strong password (32+ chars) → Save securely
   Built-in Role: Atlas admin
6. Click Create
```

### Get Connection String

```
1. Cluster → Connect → Drivers → Node.js
2. Copy connection string
3. Replace <username> with: car_rental_prod_user
4. Replace <password> with: your-secure-password
5. Append database: /CarRentalProd?retryWrites=true&w=majority&appName=CarRentalProd
6. Save as DATABASE_URL
```

### Enable Backups

```
Cluster Settings → Backup
Enable: Automated Backup
Retention: 30 days
Schedule: Daily at 02:00 UTC
```

---

## 💳 Phase 3: Stripe Production Setup (10 minutes)

### Activate Live Mode

```
1. Stripe Dashboard → Account → Settings → Account Status
2. Complete verification (business info, address, document)
3. Once verified, toggle "Live Mode" (top left)
```

### Get API Keys

```
1. Developers → API Keys → Toggle "Live Mode"
2. Copy:
   - Publishable Key: pk_live_xxx
   - Secret Key: sk_live_xxx (KEEP SECRET)
3. Save both
```

### Configure Webhook

```
1. Developers → Webhooks → Add endpoint
2. Endpoint URL: https://car-rental-api-xxxxx.onrender.com/api/v1/payments/webhook
   (You'll know the full URL after creating Render service)
3. Events: payment_intent.succeeded, payment_intent.payment_failed
4. Click Add endpoint
5. Copy Signing secret: whsec_xxx
6. Save both STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET
```

---

## 🖼️ Phase 4: Cloudinary Setup (5 minutes)

```
1. Cloudinary Dashboard → Account
2. Copy:
   - Cloud Name: your_cloud_name
   - API Key: your_api_key
   - API Secret: your_api_secret (KEEP SECRET)
3. Save all three
```

---

## 📧 Phase 5: Brevo SMTP Setup (5 minutes)

```
1. Brevo Dashboard → Settings → SMTP & API
2. Copy: SMTP_HOST=smtp-relay.brevo.com, SMTP_PORT=587

3. SMTP Credentials → Create new
4. Name: car-rental-prod
5. Copy: SMTP Username (email), SMTP Password (API Key xsmtpsib-)

6. Senders & Lists → Senders → Add sender
7. Email: noreply@yourdomain.com
8. Name: DriveEasy
9. Verify email (click confirmation link)

10. Save all SMTP variables
```

---

## 🔐 Phase 6: Google OAuth Setup (5 minutes)

```
1. Google Cloud Console → Create/Select Project
2. APIs & Services → Enable Google+ API
3. Credentials → Create OAuth 2.0 ID
4. Application: Web Application
5. Authorized JavaScript origins: https://yourdomain.com
6. Authorized redirect URIs: https://yourdomain.com
7. Copy Client ID: xxx.apps.googleusercontent.com
8. Save as GOOGLE_CLIENT_ID
```

---

## 🚀 Phase 7: Render Service Creation (10 minutes)

### Create Web Service

```
1. Render Dashboard → New + → Web Service
2. Repository: MGSAMEER/CAR_RENTAL
3. Branch: main
4. Click Create from GitHub
```

### Configure Service

```
1. Name: car-rental-backend
2. Region: Frankfurt (eu-central-1)
3. Instance: Starter Plus ($7/month)
4. Build Command: cd backend && npm ci && npm run db:generate
5. Start Command: cd backend && npm start
6. Auto-deploy: Yes (on git push)
```

### Health Check

```
Path: /health
Check interval: 30
Timeout: 10
```

### Get Service URL

```
After deployment starts:
- Note the service URL: https://car-rental-api-xxxxx.onrender.com
- This will be used for Stripe webhook endpoint
```

---

## ⚙️ Phase 8: Configure Environment Variables (15 minutes)

### In Render Dashboard → Services → car-rental-backend → Settings → Environment

Add each variable:

```env
# Core
NODE_ENV=production
PORT=5000
LOG_LEVEL=info

# Database
DATABASE_URL=mongodb+srv://car_rental_prod_user:PASSWORD@cluster.mongodb.net/CarRentalProd?retryWrites=true&w=majority&appName=CarRentalProd

# JWT (Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
JWT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
JWT_REFRESH_SECRET=yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy

# Frontend
CLIENT_URL=https://yourdomain.com

# Stripe
STRIPE_SECRET_KEY=sk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Brevo
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@brevo.com
SMTP_PASS=xsmtpsib-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SMTP_FROM=DriveEasy <noreply@yourdomain.com>

# Google
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
```

### Save Variables

```
1. Click each "Add Environment Variable"
2. Enter key and value
3. Click Save (auto-redeploys)
4. Wait for deployment to complete
```

---

## ✅ Phase 9: Verify Deployment (10 minutes)

### Check Service Status

```bash
# 1. Health check
curl https://car-rental-api-xxxxx.onrender.com/health
# Should return: {"status":"ok","services":{"database":"up",...}}

# 2. Get cars
curl https://car-rental-api-xxxxx.onrender.com/api/v1/cars
# Should return: {"success":true,"data":[...]}

# 3. Register test user
curl -X POST https://car-rental-api-xxxxx.onrender.com/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@example.com","password":"Test123!"}'
# Should return: {"success":true,"data":{"userId":"..."}}
```

### Check Logs

```
Render Dashboard → Services → car-rental-backend → Logs
Should see:
✅ Database connected successfully
🚗 Car Rental API running on http://0.0.0.0:5000
```

### Check Metrics

```
Render Dashboard → Metrics
- CPU: Should be < 20%
- Memory: Should be < 200MB
- Requests: Should show request count
```

---

## 🔗 Phase 10: Update Stripe Webhook (2 minutes)

### Update Endpoint URL

```
1. Stripe Dashboard → Developers → Webhooks
2. Find your endpoint (with the /api/v1/payments/webhook path)
3. If you added a temporary URL, update it to: 
   https://car-rental-api-xxxxx.onrender.com/api/v1/payments/webhook
4. Save
```

### Test Webhook

```bash
# Using Stripe CLI
stripe listen --forward-to https://car-rental-api-xxxxx.onrender.com/api/v1/payments/webhook
stripe trigger payment_intent.succeeded

# Check Render logs for [WEBHOOK] entries
Render → Logs → Should show webhook processing
```

---

## 📝 Phase 11: Final Verification (5 minutes)

### Test All Systems

- [ ] **Health Check**: All services return "up"
  ```bash
  curl https://your-api/health?verbose=true | jq '.services'
  ```

- [ ] **Database**: Can query data
  ```bash
  mongosh "your-connection-string"
  db.User.countDocuments()  # Should return count
  ```

- [ ] **Authentication**: Can register and login
  ```bash
  # Register: See Phase 9
  # Login should return accessToken
  ```

- [ ] **Email**: Receives verification email
  ```
  Check email for welcome/verification email
  Check Brevo Activity if not received
  ```

- [ ] **Stripe**: Payment intents work
  ```
  Try creating payment intent in frontend
  Should receive clientSecret
  ```

- [ ] **CORS**: Frontend can communicate
  ```bash
  curl -H "Origin: https://yourdomain.com" \
       -H "Access-Control-Request-Method: POST" \
       -X OPTIONS https://your-api/api/v1/auth/login
  # Should return Access-Control-Allow-Origin header
  ```

### Check Monitoring

- [ ] Uptime monitoring configured (UptimeRobot or similar)
- [ ] Error tracking configured (Sentry or similar)
- [ ] Slack alerts setup (if desired)
- [ ] Team notified of deployment

---

## 🎓 Phase 12: Documentation & Training (5 minutes)

### Update Frontend Configuration

```javascript
// frontend/lib/api.ts or frontend/.env
NEXT_PUBLIC_API_URL=https://car-rental-api-xxxxx.onrender.com
```

### Document Important Info

Create internal documentation with:
- [ ] Service URL: https://car-rental-api-xxxxx.onrender.com
- [ ] Service ID: srv_xxxxx (for API calls)
- [ ] Main contacts for each service
- [ ] Runbook for common issues
- [ ] Escalation procedures

### Team Training

- [ ] Show team how to access Render Dashboard
- [ ] Explain how to restart service if needed
- [ ] Explain how to view logs
- [ ] Explain how to update environment variables
- [ ] Practice emergency rollback procedure

---

## 🚨 Phase 13: Post-Deployment Monitoring (24 hours)

### First Hour (Critical)

```
Every 5 minutes for first hour:
- Check health endpoint
- Review logs for errors
- Monitor metrics
```

### First 24 Hours

```
Multiple times per day:
- Check uptime dashboard
- Review error tracking
- Test core workflows (register, book, pay)
- Monitor external service status pages
```

### Weekly Checks

```
- Review performance metrics
- Check error rates
- Test backup restoration
- Review database growth
- Plan scaling if needed
```

---

## 📋 Complete Variable Reference

```env
# Save this for future reference

API_URL=https://car-rental-api-xxxxx.onrender.com

# Core
NODE_ENV=production
PORT=5000

# Database
DATABASE_URL=mongodb+srv://car_rental_prod_user:PASSWORD@cluster.mongodb.net/CarRentalProd?retryWrites=true&w=majority&appName=CarRentalProd

# Auth
JWT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
JWT_REFRESH_SECRET=yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy

# Frontend
CLIENT_URL=https://yourdomain.com

# Stripe
STRIPE_PUBLISHABLE_KEY=pk_live_xxxxx (for frontend)
STRIPE_SECRET_KEY=sk_live_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Brevo
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@brevo.com
SMTP_PASS=xsmtpsib-xxxxx
SMTP_FROM=DriveEasy <noreply@yourdomain.com>

# Google
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
```

---

## 🎉 Deployment Complete!

Your car rental SaaS backend is now running on Render:

✅ Service: Node.js Express API  
✅ Database: MongoDB Atlas  
✅ Payments: Stripe (Live Mode)  
✅ Email: Brevo SMTP  
✅ Storage: Cloudinary  
✅ Auth: JWT + Google OAuth  
✅ Monitoring: Health checks  
✅ Scaling: Auto-scaling ready  

### Next Steps:
1. Deploy frontend (point to API_URL)
2. Set up domain/SSL (Render provides free SSL)
3. Configure DNS records
4. Run final end-to-end tests
5. Announce to users
6. Monitor for 24-48 hours
7. Plan for scaling based on usage

---

## 📞 Quick Links

- Render Dashboard: https://dashboard.render.com
- MongoDB Atlas: https://cloud.mongodb.com
- Stripe Dashboard: https://dashboard.stripe.com
- Brevo Dashboard: https://app.brevo.com
- Cloudinary Dashboard: https://cloudinary.com/console

---

**Estimated Total Time**: 45-60 minutes  
**Deployment Date**: May 23, 2026  
**Status**: ✅ Production Ready
