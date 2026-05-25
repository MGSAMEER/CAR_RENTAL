# 🚀 RENDER DEPLOYMENT EXECUTION PLAN
**Status**: In Progress  
**Date**: May 23, 2026  
**User**: DevOps Engineer

---

## ✅ Phase 1: Pre-Deployment - COMPLETE

**Status**: ✅ DONE

### Verified:
- ✅ Backend code is ready (tested locally, database connects)
- ✅ `.gitignore` created with `.env` file protection
- ✅ No secrets exposed in git
- ✅ Dependencies installed (npm packages ready)
- ✅ Database connection working (MongoDB Atlas online)

**Evidence:**
```
Database connected successfully ✅
Express server ready to start ✅
```

---

## 📋 Phase 2: MongoDB Atlas Setup (10 minutes)

**Status**: ⏳ TODO

### Prerequisites:
- [ ] Go to: https://www.mongodb.com/cloud/atlas
- [ ] Login or create account

### Step-by-Step:

1. **Create Project**
   ```
   Dashboard → Create Project
   Project Name: car-rental-prod
   Click Create
   ```

2. **Build Cluster**
   ```
   Click "Build a Database"
   Choose Free (M5 Shared)
   Provider: AWS
   Region: eu-central-1 (Frankfurt - closest to Europe)
   Click Create
   Wait 5-10 minutes...
   ```

3. **Configure Network Access**
   ```
   Left sidebar → Network Access
   Click "Add IP Address"
   
   FOR PRODUCTION:
   IP: 3.121.23.0/24 (Render EU Frankfurt range)
   
   FOR DEVELOPMENT:
   IP: 0.0.0.0/0 (Allow all - development only)
   
   Click Confirm
   ```

4. **Create Database User**
   ```
   Left sidebar → Database Access
   Click "Add New Database User"
   
   Username: car_rental_prod_user
   Password: [GENERATE STRONG - use password manager]
       - 32+ characters
       - Include: uppercase, lowercase, numbers, symbols
       - Example: K$9xL#mN2p@vQ4rT!wY5zAbCdEfGhIjKl
   
   Built-in Role: Atlas admin
   Click Create User
   
   ⚠️ SAVE PASSWORD SECURELY!
   ```

5. **Get Connection String**
   ```
   Go to Clusters → Click Connect
   Choose Drivers → Node.js
   Copy the connection string
   
   Example:
   mongodb+srv://car_rental_prod_user:<password>@cluster.mongodb.net/?retryWrites=true&w=majority
   
   Modify it:
   - Replace <password> with your actual password
   - Replace <cluster> with actual cluster name
   - Append database: /CarRentalProd?retryWrites=true&w=majority&appName=CarRentalProd
   
   FINAL:
   mongodb+srv://car_rental_prod_user:YOUR_PASSWORD_HERE@cluster-xxxxx.mongodb.net/CarRentalProd?retryWrites=true&w=majority&appName=CarRentalProd
   
   ⚠️ SAVE THIS - needed for Render environment
   ```

6. **Enable Backups**
   ```
   Cluster Settings → Backup
   Toggle: "Enable Automated Backup"
   Retention: 30 days
   Schedule: Daily at 02:00 UTC
   ```

---

## 💳 Phase 3: Stripe Production Setup (10 minutes)

**Status**: ⏳ TODO

### Prerequisites:
- [ ] Go to: https://stripe.com
- [ ] Create or login to account
- [ ] Must complete verification (business info, address, document)

### Step-by-Step:

1. **Activate Live Mode**
   ```
   Dashboard → Account → Settings → Account Status
   
   Complete verification:
   - Business information
   - Business address
   - Business type (e.g., SaaS)
   - Upload verification document
   
   Once verified:
   Top left corner → Toggle to "Live Mode"
   ```

2. **Get Production API Keys**
   ```
   Left sidebar → Developers → API Keys
   
   MAKE SURE "Live Mode" is toggled on (top left)
   
   Copy:
   - Publishable Key: pk_live_xxxxx (can be public)
   - Secret Key: YOUR_STRIPE_LIVE_SECRET_KEY (KEEP SECRET!)
   
   ⚠️ SAVE BOTH - needed for Render environment
   ```

3. **Configure Webhook Endpoint**
   ```
   Left sidebar → Developers → Webhooks
   Click "Add endpoint"
   
   Endpoint URL: [You'll get this from Render after creating service]
   Format: https://car-rental-api-xxxxx.onrender.com/api/v1/payments/webhook
   
   Events to receive:
   - payment_intent.succeeded
   - payment_intent.payment_failed
   - charge.refunded
   
   Click "Add endpoint"
   
   Copy Signing secret: YOUR_STRIPE_WEBHOOK_SECRET
   ⚠️ SAVE THIS - needed for Render environment
   ```

---

## 🖼️ Phase 4: Cloudinary Setup (5 minutes)

**Status**: ⏳ TODO

### Step-by-Step:

1. **Create Account**
   ```
   Go to: https://cloudinary.com
   Sign up (Free tier: 5GB storage)
   Confirm email
   ```

2. **Get API Credentials**
   ```
   Dashboard → Account Settings
   
   Copy:
   - Cloud Name: your_cloud_name
   - API Key: xxxxx
   - API Secret: xxxxx (KEEP SECRET!)
   
   ⚠️ SAVE ALL THREE - needed for Render environment
   ```

3. **Configure Upload Settings** (Optional but recommended)
   ```
   Settings → Upload
   
   Create new upload preset:
   - Name: car_rental_uploads
   - Unsigned: Yes (for frontend uploads)
   - Folder: car-rental/uploads
   - Resource type: Image
   - Max file size: 5MB
   - Allowed image types: jpg, png, webp
   ```

---

## 📧 Phase 5: Brevo SMTP Setup (5 minutes)

**Status**: ⏳ TODO

### Step-by-Step:

1. **Create Account**
   ```
   Go to: https://www.brevo.com
   Sign up (Free tier: 300 emails/day)
   Confirm email
   ```

2. **Get SMTP Configuration**
   ```
   Dashboard → Settings → SMTP & API
   
   Copy:
   - SMTP_HOST: smtp-relay.brevo.com
   - SMTP_PORT: 587
   - SMTP_SECURE: false
   
   ⚠️ SAVE THESE - needed for Render environment
   ```

3. **Create SMTP Credentials**
   ```
   SMTP & API → SMTP Credentials
   Click "Create new"
   
   Name: car-rental-prod
   Type: API Key (recommended)
   
   Copy:
   - SMTP Username: your-brevo-email@example.com
   - SMTP Password: YOUR_BREVO_SMTP_API_KEY (This is API Key!)
   
   ⚠️ SAVE BOTH - needed for Render environment
   ```

4. **Verify Sender Email**
   ```
   Senders & Lists → Senders
   Click "Add a sender"
   
   Email: noreply@yourdomain.com
   Name: DriveEasy
   
   Check your email for verification link
   Click confirmation link
   
   ⚠️ MUST VERIFY before emails work!
   ```

---

## 🔐 Phase 6: Google OAuth Setup (5 minutes)

**Status**: ⏳ TODO

### Step-by-Step:

1. **Create Google Cloud Project**
   ```
   Go to: https://console.cloud.google.com
   
   Create new project:
   Project Name: car-rental-prod
   Click Create
   ```

2. **Enable Google+ API**
   ```
   APIs & Services → Library
   Search: "Google+ API"
   Click it
   Click "Enable"
   ```

3. **Create OAuth 2.0 Credentials**
   ```
   APIs & Services → Credentials
   Click "Create Credentials" → OAuth 2.0 Client ID
   
   Application type: Web application
   
   Authorized JavaScript origins:
   - https://yourdomain.com
   
   Authorized redirect URIs:
   - https://yourdomain.com
   
   Click Create
   ```

4. **Get Client ID**
   ```
   Copy: Client ID (format: xxxxx.apps.googleusercontent.com)
   
   ⚠️ SAVE THIS - needed for Render environment
   Note: Keep Client Secret if you need it later for backend verification
   ```

---

## 🚀 Phase 7: Render Service Creation (10 minutes)

**Status**: ⏳ TODO

### Prerequisites:
- [ ] Go to: https://render.com
- [ ] Create account
- [ ] Connect GitHub repository (MGSAMEER/CAR_RENTAL)

### Step-by-Step:

1. **Create Web Service**
   ```
   Dashboard → New + → Web Service
   
   Repository: MGSAMEER/CAR_RENTAL
   Branch: main
   Root Directory: backend
   
   Click "Create from GitHub"
   ```

2. **Configure Service**
   ```
   Name: car-rental-backend
   
   Runtime: Node (auto-selected)
   Region: Frankfurt (eu-central-1)
   Instance: Starter Plus ($7/month)
   
   Build Command: npm ci && npm run db:generate
   Start Command: npm start
   
   Auto-deploy: Yes (from main branch)
   ```

   Why:
   - The repository is a monorepo with `frontend/` and `backend/`.
   - Render must use `backend/` as the root directory so it finds `backend/package.json`.
   - Build and start commands run inside `backend/`, so do not prefix them with `cd backend`.

3. **Configure Health Check**
   ```
   Path: /health
   Check interval: 30
   Timeout: 10
   ```

4. **Note Service URL**
   ```
   After creation, you'll see:
   Service URL: https://car-rental-api-xxxxx.onrender.com
   
   ⚠️ SAVE THIS!
   
   You need this for:
   - Stripe webhook endpoint
   - Frontend API configuration
   - CORS settings
   ```

---

## ⚙️ Phase 8: Configure Environment Variables (15 minutes)

**Status**: ⏳ TODO

### Location:
Render Dashboard → Services → car-rental-backend → Settings → Environment

### Variables to Add:

```env
# Core Configuration
NODE_ENV=production
PORT=5000
LOG_LEVEL=info

# Database (MongoDB Atlas)
DATABASE_URL=mongodb+srv://car_rental_prod_user:PASSWORD@cluster.mongodb.net/CarRentalProd?retryWrites=true&w=majority&appName=CarRentalProd

# JWT Authentication
JWT_SECRET=<GENERATE - see below>
JWT_REFRESH_SECRET=<GENERATE - see below>

# Client URL
CLIENT_URL=https://yourdomain.com

# Stripe
STRIPE_SECRET_KEY=YOUR_STRIPE_LIVE_SECRET_KEY
STRIPE_WEBHOOK_SECRET=YOUR_STRIPE_WEBHOOK_SECRET

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Brevo SMTP
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@brevo.com
SMTP_PASS=YOUR_BREVO_SMTP_API_KEY
SMTP_FROM=DriveEasy <noreply@yourdomain.com>

# Google OAuth
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
```

### How to Add:
```
1. Click "Add Environment Variable"
2. Enter Key (e.g., NODE_ENV)
3. Enter Value (e.g., production)
4. Click Save
5. Render automatically redeploys
6. Repeat for all variables
```

---

## ✅ Phase 9: Verify Deployment (10 minutes)

**Status**: ⏳ TODO

### After environment variables are saved and service redeploys:

```bash
# 1. Test Health Check
curl https://car-rental-api-xxxxx.onrender.com/health

# Expected Response:
{
  "status": "ok",
  "services": {
    "database": "up",
    "stripe": "up",
    "smtp": "up",
    "background_queues": "up"
  }
}

# 2. Get Cars
curl https://car-rental-api-xxxxx.onrender.com/api/v1/cars

# Expected Response:
{
  "success": true,
  "data": []
}

# 3. Test User Registration
curl -X POST https://car-rental-api-xxxxx.onrender.com/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@example.com","password":"Test123!"}'

# Expected Response:
{
  "success": true,
  "data": {"userId":"..."}
}
```

### Check Logs:
```
Render Dashboard → Services → car-rental-backend → Logs

Look for:
✅ Database connected successfully
🚗 Car Rental API running on http://0.0.0.0:5000
```

### Check Metrics:
```
Render Dashboard → Metrics

Should show:
- CPU: < 20%
- Memory: < 200MB
- Request count increasing
```

---

## 🔗 Phase 10: Update Stripe Webhook (2 minutes)

**Status**: ⏳ TODO

### Update Endpoint URL in Stripe:

```
1. Stripe Dashboard → Developers → Webhooks
2. Find your endpoint
3. Update URL to: https://car-rental-api-xxxxx.onrender.com/api/v1/payments/webhook
4. Save
```

### Test Webhook (Optional):
```bash
# Install Stripe CLI: https://stripe.com/docs/stripe-cli

stripe listen --forward-to https://car-rental-api-xxxxx.onrender.com/api/v1/payments/webhook

# In another terminal:
stripe trigger payment_intent.succeeded

# Check Render logs for webhook processing
```

---

## 📝 Phase 11: Final Verification (5 minutes)

**Status**: ⏳ TODO

### Complete Verification Checklist:

- [ ] Health check returns all services "up"
- [ ] Database queries work (can retrieve data)
- [ ] User registration works (email sent)
- [ ] Login works (returns tokens)
- [ ] Frontend can communicate (CORS working)
- [ ] Stripe payment intents work
- [ ] Emails send correctly (check inbox)
- [ ] Logs show no errors
- [ ] Metrics show healthy CPU/Memory

---

## 🎓 Phase 12: Documentation & Training (5 minutes)

**Status**: ⏳ TODO

### Update Frontend Configuration:
```javascript
// frontend/.env or frontend/lib/api.ts
NEXT_PUBLIC_API_URL=https://car-rental-api-xxxxx.onrender.com
```

### Document Important Info:
```
Create internal wiki/document with:
- Service URL
- Service ID (from Render)
- Emergency contacts
- Runbook for common issues
- Rollback procedure
```

---

## 🚨 Phase 13: Post-Deployment Monitoring (24+ hours)

**Status**: ⏳ TODO

### First Hour (Critical):
```
Every 5 minutes:
- Check health endpoint
- Review logs for errors
- Monitor metrics (CPU, Memory)
```

### First 24 Hours:
```
Multiple times per day:
- Check uptime dashboard
- Review error tracking
- Test core workflows
- Monitor external service status
```

### Ongoing:
```
Daily:
- Review error logs
- Check performance metrics
- Monitor database growth
- Verify backups running
```

---

## 📊 SECRETS GENERATION

### Generate JWT Secrets (Do this locally):

**Option 1: Node.js**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Option 2: PowerShell**
```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object {[byte](Get-Random -Max 256)}))
```

**Generate two different secrets:**
1. JWT_SECRET: `[first output]`
2. JWT_REFRESH_SECRET: `[second output]`

**Store securely:**
- Use password manager
- Do NOT commit to git
- Share only with authorized personnel

---

## 🎯 DEPLOYMENT SUMMARY

### Total Time: 60-90 minutes
```
Phase 1: Pre-Deployment          ✅ 10 min (DONE)
Phase 2: MongoDB Atlas           ⏳ 10 min
Phase 3: Stripe Production       ⏳ 10 min
Phase 4: Cloudinary             ⏳ 5 min
Phase 5: Brevo SMTP             ⏳ 5 min
Phase 6: Google OAuth           ⏳ 5 min
Phase 7: Render Service         ⏳ 10 min
Phase 8: Environment Variables  ⏳ 15 min
Phase 9: Verify Deployment      ⏳ 10 min
Phase 10: Stripe Webhooks       ⏳ 2 min
Phase 11: Final Verification    ⏳ 5 min
Phase 12: Documentation         ⏳ 5 min
Phase 13: Monitoring            ⏳ Setup ongoing
─────────────────────────────────────────
TOTAL                           ~90 min
```

### What You'll Have After:
```
✅ Production-grade Node.js API running on Render
✅ MongoDB Atlas with automatic backups
✅ Stripe payment processing (Live mode)
✅ Brevo email delivery
✅ Cloudinary file storage with CDN
✅ Google OAuth authentication
✅ Health checks & monitoring
✅ Auto-scaling ready
✅ Zero-downtime deployments
✅ Security best practices
```

---

## 📞 SUPPORT

If you get stuck on any phase:
1. Check: PRODUCTION_DEBUGGING_GUIDE.md
2. Reference: ENV_VARIABLES_TEMPLATE.md
3. Read: RENDER_PRODUCTION_DEPLOYMENT.md (full details)

---

**Status**: Phase 1 Complete ✅, Phase 2-13 Ready to Execute  
**Next Step**: Follow Phase 2 (MongoDB Atlas Setup)

