# 🔐 Production Environment Variables Template

**⚠️ IMPORTANT: Do NOT commit .env file to git**

**⚠️ CRITICAL: Keep sensitive values secure - use Render Dashboard to manage these**

---

## 📋 How to Use This Template

1. **Option A: Render Dashboard (Recommended)**
   - Render Dashboard → Web Service → Settings → Environment
   - Add each variable individually
   - Click Save after each addition

2. **Option B: render.yaml (Infrastructure as Code)**
   - Edit `render.yaml` in repository
   - Set `sync: false` for sensitive variables
   - Render auto-detects and applies

3. **Option C: Manual Deployment**
   - Create `.env.production` file locally (NOT in git)
   - Set variables here for local testing
   - Delete after testing

---

## ✅ Required Environment Variables

### Core Configuration

```env
# Server Environment
NODE_ENV=production

# Server Port (Render assigns automatically)
PORT=5000

# Logging Level (info, warn, error, debug)
LOG_LEVEL=info
```

**Explanation:**
- `NODE_ENV=production`: Enables production optimizations
- `PORT=5000`: Node.js server port (Render forwards from 443)
- `LOG_LEVEL=info`: Log level (reduce debug logs in production)

---

### Database Configuration (MongoDB Atlas)

```env
# MongoDB Atlas Connection String
# Format: mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority
DATABASE_URL=mongodb+srv://car_rental_prod_user:YOUR_VERY_SECURE_PASSWORD_32_CHARS_MIN@car-rental-prod.xxxxx.mongodb.net/CarRentalProd?retryWrites=true&w=majority&appName=CarRentalProd
```

**How to get this:**
1. MongoDB Atlas Dashboard → Cluster → Connect
2. Click "Drivers"
3. Copy connection string
4. Replace `<username>:<password>` with actual credentials
5. Replace `<database>` with `CarRentalProd`
6. Special characters in password need URL encoding

**Example:**
```
Password: MyP@ssw0rd!  
URL-encoded: MyP%40ssw0rd%21
```

---

### JWT Authentication (JSON Web Tokens)

```env
# JWT Access Token Secret (used to sign short-lived tokens)
# Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2

# JWT Refresh Token Secret (used to sign long-lived tokens)
# Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_REFRESH_SECRET=f2e1d0c9b8a7z6y5x4w3v2u1t0s9r8q7p6o5n4m3l2k1j0i9h8g7f6e5d4c3b2
```

**Token Expiry:**
- Access Token: 1 hour
- Refresh Token: 7 days

**How to generate secrets:**
```bash
# Option 1: Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Option 2: OpenSSL
openssl rand -hex 32

# Option 3: Python
python -c "import secrets; print(secrets.token_hex(32))"

# Option 4: Online tool
# https://www.random.org/passwords/ (select 32 characters)
```

---

### CORS & Frontend URL

```env
# Frontend application URL (where users access the app)
# Used for CORS validation and OAuth redirects
CLIENT_URL=https://yourdomain.com
```

**Examples:**
```
Production: https://app.yourdomain.com
Staging: https://staging.yourdomain.com
Development: http://localhost:3000 (dev only)
```

**CORS Policy:**
- Frontend at `https://app.yourdomain.com` can make requests to backend
- Requests from other origins are rejected

---

### Stripe Payment Processing

```env
# Stripe Secret API Key (LIVE MODE - for production)
# Get from: Stripe Dashboard → Developers → API Keys → Live Mode
# Key starts with: sk_live_
STRIPE_SECRET_KEY=YOUR_STRIPE_LIVE_SECRET_KEY

# Stripe Webhook Signing Secret (for webhook verification)
# Get from: Stripe Dashboard → Developers → Webhooks → Signing secret
# Secret starts with: whsec_
STRIPE_WEBHOOK_SECRET=YOUR_STRIPE_WEBHOOK_SECRET
```

**Critical Notes:**
- ⚠️ MUST use `sk_live_` key (NOT `sk_test_`)
- ⚠️ MUST use `whsec_` webhook secret
- ⚠️ KEEP THESE SECRETS ABSOLUTELY SECURE
- Webhook endpoint: `https://your-api-url/api/v1/payments/webhook`

**How to get keys:**
1. Stripe Dashboard → Developers
2. Toggle to **Live Mode** (top left)
3. Copy both Publishable and Secret keys
4. Go to Webhooks → Copy Signing secret

---

### Cloudinary Image Storage

```env
# Cloudinary Cloud Name (public, visible in URLs)
CLOUDINARY_CLOUD_NAME=your_cloud_name_here

# Cloudinary API Key (public, but keep secure)
CLOUDINARY_API_KEY=1234567890123456

# Cloudinary API Secret (KEEP SECRET - never expose)
CLOUDINARY_API_SECRET=YOUR_API_SECRET_32_CHARS_MIN_HERE
```

**How to get credentials:**
1. Cloudinary Dashboard → Account
2. Copy Cloud Name, API Key, API Secret

**Usage:**
- Store car images, user documents, etc.
- Files automatically cached on CDN

---

### Brevo SMTP Configuration (Email)

```env
# Email service provider: Brevo (formerly Sendinblue)
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_SECURE=false

# Brevo SMTP credentials
# Email: Your Brevo account email
# Password: Brevo API Key (starts with xsmtpsib-) - NOT your password
SMTP_USER=your-email@brevo.com
SMTP_PASS=YOUR_BREVO_SMTP_API_KEY

# Sender email configuration
# Name and email address for "From" field
SMTP_FROM=DriveEasy <noreply@yourdomain.com>
```

**How to get credentials:**
1. Brevo Dashboard → Settings → SMTP & API
2. Copy SMTP server and port
3. Go to SMTP Credentials → Create new
4. Copy SMTP Username and SMTP Password (API Key)

**Email Features:**
- Send welcome emails
- Send booking confirmations
- Send password reset links
- Send payment receipts

**Rate Limits:**
- Free tier: 300 emails/day
- Paid tier: 20,000+ emails/day

---

### Google OAuth Authentication

```env
# Google OAuth Client ID
# Get from: Google Cloud Console → APIs & Services → Credentials
# Format: {PROJECT_ID}.apps.googleusercontent.com
GOOGLE_CLIENT_ID=1234567890-abcdefg1234567890abcdefg12345678.apps.googleusercontent.com
```

**How to set up:**
1. Google Cloud Console: https://console.cloud.google.com
2. Create/select project
3. Enable Google+ API
4. Create OAuth 2.0 credentials:
   - Application type: Web application
   - Authorized JavaScript origins: `https://yourdomain.com`
   - Authorized redirect URIs: `https://yourdomain.com` (frontend handles)

**Frontend Setup:**
- Frontend sends token to backend
- Backend verifies token with Google
- Creates/updates user session

---

### Redis Cache (Optional)

```env
# Redis connection URL (optional - for caching/sessions)
# If using Render Redis service:
REDIS_URL=redis://default:PASSWORD@redis-instance.render.internal:6379

# Leave empty to disable Redis features
```

---

## 🔒 Security Best Practices

### 1. Secret Rotation Schedule
```
Monthly: Rotate JWT secrets
Quarterly: Rotate MongoDB password
Quarterly: Rotate Stripe test/live keys
As needed: If any key is exposed
```

### 2. Access Control
```
❌ Do NOT:
  - Commit .env files
  - Share secrets in chat/email
  - Use same secret across environments
  - Expose secrets in client-side code
  - Log secrets in error messages

✅ DO:
  - Store in Render Dashboard
  - Use secret management tools
  - Rotate regularly
  - Use strong passwords (32+ chars)
  - Audit access logs
```

### 3. Monitoring
```
Track:
  - Who accessed secrets
  - When keys were rotated
  - Failed authentication attempts
  - Unusual API usage
```

---

## 🧪 Validation Checklist

After setting all variables, verify:

```bash
# 1. Health check
curl https://your-api-url/health

# 2. Database connection
# Should show "database: up"

# 3. Stripe connection
# Should show "stripe: up"

# 4. SMTP connection  
# Should show "smtp: up"

# 5. Test authentication
curl -X POST https://your-api-url/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test",
    "email": "test@example.com",
    "password": "TestPassword123!"
  }'

# 6. Check logs for errors
# Render Dashboard → Logs
```

---

## 📊 Environment Variable Summary Table

| Variable | Type | Required | Source | Secret |
|----------|------|----------|--------|--------|
| NODE_ENV | String | Yes | - | No |
| PORT | Number | Yes | Render | No |
| LOG_LEVEL | String | No | - | No |
| DATABASE_URL | String | Yes | MongoDB Atlas | **Yes** |
| JWT_SECRET | String | Yes | Generate | **Yes** |
| JWT_REFRESH_SECRET | String | Yes | Generate | **Yes** |
| CLIENT_URL | String | Yes | Your domain | No |
| STRIPE_SECRET_KEY | String | Yes | Stripe (Live) | **Yes** |
| STRIPE_WEBHOOK_SECRET | String | Yes | Stripe | **Yes** |
| CLOUDINARY_CLOUD_NAME | String | Yes | Cloudinary | No |
| CLOUDINARY_API_KEY | String | Yes | Cloudinary | No |
| CLOUDINARY_API_SECRET | String | Yes | Cloudinary | **Yes** |
| SMTP_HOST | String | Yes | Brevo | No |
| SMTP_PORT | Number | Yes | Brevo | No |
| SMTP_SECURE | Boolean | Yes | Brevo | No |
| SMTP_USER | String | Yes | Brevo | **Yes** |
| SMTP_PASS | String | Yes | Brevo (API Key) | **Yes** |
| SMTP_FROM | String | Yes | Your domain | No |
| GOOGLE_CLIENT_ID | String | Yes | Google Cloud | No |
| REDIS_URL | String | No | Render Redis | **Yes** |

---

## 🚀 Setting Variables in Render

### Method 1: Dashboard (Recommended)

```
1. Render Dashboard → Services → car-rental-backend
2. Settings → Environment
3. Click "Add Environment Variable"
4. Enter key and value
5. Click Save (auto-redeploys)
```

### Method 2: Infrastructure as Code

```
1. Edit render.yaml in repository
2. Add variables under envVars
3. Push to GitHub
4. Render auto-redeploys
```

### Method 3: Bulk Import

```
1. Prepare .env file with all variables
2. Render Dashboard → Environment → Import
3. Upload .env file
4. Review variables
5. Click Import
```

---

## ⚠️ Common Mistakes to Avoid

```bash
❌ WRONG: PASSWORD_WITH_SPECIAL_CHARS="MyP@ssw0rd!"
# Special chars must be URL-encoded in DATABASE_URL

✅ RIGHT: DATABASE_URL="mongodb+srv://user:MyP%40ssw0rd%21@cluster.mongodb.net/db"

---

❌ WRONG: Using sk_test_ key in production
# This routes payments to test mode

✅ RIGHT: Using sk_live_ key only in production

---

❌ WRONG: Committing .env to git
# Secrets exposed to everyone with repo access

✅ RIGHT: .env in .gitignore, use Render Dashboard

---

❌ WRONG: Missing MongoDB "appName" parameter
# Causes connection issues

✅ RIGHT: &appName=CarRentalProd at end of DATABASE_URL

---

❌ WRONG: Using test webhook secret for live payments
# Webhook verification fails

✅ RIGHT: Use whsec_ secret from live Stripe account
```

---

## 🔄 Updating Environment Variables

### Zero-Downtime Updates

```
1. Update variable in Render Dashboard
2. Render automatically redeploys service
3. New processes use updated value
4. Old processes continue until replaced
5. No downtime (blue-green deployment)
```

### Sensitive Update Procedure

```
For critical variables (JWT_SECRET, STRIPE_KEY):
1. Create backup of old value
2. Update in Render Dashboard
3. Monitor logs for errors
4. Be ready to rollback if needed
5. Document change with timestamp
```

---

## 📞 Support & Troubleshooting

**Variable not taking effect:**
```
1. Check variable is correctly named (case-sensitive)
2. Verify Render service redeployed (check Deployments tab)
3. Check logs for error messages
4. Clear browser cache
5. Hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
```

**Connection errors:**
```
1. Verify credentials are correct
2. Check special characters are URL-encoded
3. Test connection locally with same credentials
4. Check firewall/network access restrictions
5. Review service status pages
```

---

## 📚 References

- Render Docs: https://render.com/docs
- Stripe API: https://stripe.com/docs/api
- MongoDB Connection: https://docs.mongodb.com/drivers/node
- Brevo SMTP: https://www.brevo.com/guide/smtp-configuration
- Cloudinary: https://cloudinary.com/documentation

---

**Template Version**: 1.0  
**Last Updated**: May 23, 2026  
**Status**: Ready for Production

