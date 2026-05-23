# 🚀 Render Deployment: Quick Reference Guide

**Use this for rapid deployments and troubleshooting**

---

## 🏃 5-Minute Deployment Checklist

```bash
# 1. Verify all environment variables are set in Render Dashboard
# 2. Verify git branch is correct (main)
# 3. Push code to GitHub
# 4. Render auto-deploys (check Service → Deployments)
# 5. Verify health check: https://api-url/health
# 6. Test core endpoints
```

---

## 📦 Required Environment Variables

Copy this template to Render Dashboard → Web Service → Environment:

```env
# Core
NODE_ENV=production
PORT=5000

# Database
DATABASE_URL=mongodb+srv://user:password@cluster.mongodb.net/DatabaseName?retryWrites=true&w=majority&appName=CarRentalProd

# Auth
JWT_SECRET=min-32-chars-secure-random-string
JWT_REFRESH_SECRET=min-32-chars-secure-random-string

# Frontend
CLIENT_URL=https://yourdomain.com

# Stripe
STRIPE_SECRET_KEY=YOUR_STRIPE_LIVE_SECRET_KEY
STRIPE_WEBHOOK_SECRET=YOUR_STRIPE_WEBHOOK_SECRET

# Cloudinary
CLOUDINARY_CLOUD_NAME=xxxxx
CLOUDINARY_API_KEY=xxxxx
CLOUDINARY_API_SECRET=xxxxx

# Brevo SMTP
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@brevo.com
SMTP_PASS=YOUR_BREVO_SMTP_API_KEY
SMTP_FROM=DriveEasy <noreply@yourdomain.com>

# Google OAuth
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com

# Logging
LOG_LEVEL=info
```

---

## 🔗 Service URLs Reference

After deployment, note these:

| Service | URL |
|---------|-----|
| API Base | `https://car-rental-api-xxxxx.onrender.com` |
| Health Check | `https://car-rental-api-xxxxx.onrender.com/health` |
| Webhook | `https://car-rental-api-xxxxx.onrender.com/api/v1/payments/webhook` |

---

## 🧪 Quick Test Commands

```bash
# 1. Health check
curl https://car-rental-api-xxxxx.onrender.com/health

# 2. Get cars
curl https://car-rental-api-xxxxx.onrender.com/api/v1/cars

# 3. Register test user
curl -X POST https://car-rental-api-xxxxx.onrender.com/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@example.com","password":"Test123!"}'

# 4. Login test user
curl -X POST https://car-rental-api-xxxxx.onrender.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!"}'
```

---

## 🔧 Common Issues & Fixes

### Database connection fails
```
Error: MongoNetworkError
Fix: 
1. Check DATABASE_URL is correct
2. Add Render IP to MongoDB Atlas: 3.121.23.0/24
3. Test connection: mongosh "your-connection-string"
```

### Stripe webhook fails
```
Error: Signature verification failed
Fix:
1. Verify STRIPE_WEBHOOK_SECRET in Render matches Stripe Dashboard
2. Webhook endpoint must be: /api/v1/payments/webhook
3. Test: stripe listen --forward-to your-api/api/v1/payments/webhook
```

### Emails not sending
```
Error: Invalid credentials
Fix:
1. SMTP_PASS must be Brevo API Key (starts with xsmtpsib-)
2. Verify sender email is verified in Brevo
3. Check daily limit: 300/day (free tier)
```

### High memory usage
```
Symptoms: Service crashes or slows down
Fix:
1. Check Render Metrics → Memory
2. Upgrade instance type if needed
3. Restart service from Render Dashboard
```

### Rate limiting errors
```
Error: 429 Too Many Requests
Fix: Adjust rate limit in backend/src/app.js
```

---

## 🚀 Redeployment Process

### After Code Changes
```bash
# 1. Commit to main branch
git add .
git commit -m "Your message"
git push origin main

# 2. Render auto-deploys (check Deployments tab)
# 3. Verify health check passes
# 4. Test endpoints

# OR manual redeploy:
# Render Dashboard → Web Service → Deployments → Deploy
```

### After Environment Variable Changes
```bash
# 1. Update variable in Render Dashboard → Environment
# 2. Save change
# 3. Click "Manual Deploy" (or auto-redeploys)
# 4. Verify in logs and health check
```

---

## 📊 Monitoring Commands

```bash
# View service logs (Render Dashboard)
# Render → Web Service → Logs

# View deployment status
# Render → Web Service → Deployments

# View metrics
# Render → Web Service → Metrics (CPU, Memory, Requests)

# Check health in real-time
curl https://car-rental-api-xxxxx.onrender.com/health?verbose=true | jq

# Check MongoDB connection
mongosh "your-connection-string" <<EOF
  db.admin.ping()
  db.User.countDocuments()
EOF
```

---

## 🔐 Secure Deployment Checklist

- [ ] No secrets in git repo
- [ ] `.env` in `.gitignore`
- [ ] All secrets in Render environment variables
- [ ] Stripe webhook secret properly configured
- [ ] Database password is strong (32+ chars)
- [ ] JWT secrets are strong (32+ chars)
- [ ] CORS allows only frontend domain
- [ ] Rate limiting enabled
- [ ] HTTPS enforced (automatic on Render)
- [ ] Security headers enabled (Helmet)

---

## 🚨 Emergency Procedures

### Service is down
```bash
# 1. Check Render status
curl https://car-rental-api-xxxxx.onrender.com/health

# 2. View logs for errors
# Render Dashboard → Logs

# 3. If still down, restart service
# Render Dashboard → Service → Restart

# 4. Check database
mongosh "connection-string"
  db.admin.ping()
```

### Rollback to previous version
```bash
# Render Dashboard → Deployments
# Click previous deployment → Redeploy
```

### Database is down
```bash
# Check MongoDB Atlas status: https://status.mongodb.com
# Check connection: mongosh "connection-string"
# If network issue, check IP whitelist in MongoDB Atlas
```

---

## 📞 Quick Links

- Render Dashboard: https://dashboard.render.com
- MongoDB Atlas: https://cloud.mongodb.com
- Stripe Dashboard: https://dashboard.stripe.com (Live Mode)
- Brevo: https://app.brevo.com
- Cloudinary: https://cloudinary.com/console

---

## 💡 Performance Targets

Expected metrics for healthy production service:

| Metric | Target | Action if Exceeded |
|--------|--------|------------------|
| Response Time | < 200ms | Check DB query performance |
| CPU Usage | < 50% | Optimize code or upgrade |
| Memory Usage | < 70% | Check for memory leaks |
| Error Rate | < 0.5% | Review error logs |
| Uptime | > 99.9% | Investigate downtime |

---

## 🎓 Learning Resources

- **Render Docs**: https://render.com/docs
- **Express.js**: https://expressjs.com
- **Prisma**: https://www.prisma.io/docs
- **Stripe API**: https://stripe.com/docs/api
- **MongoDB**: https://docs.mongodb.com

---

**Last Updated**: May 23, 2026  
**Deployment Platform**: Render  
**Environment**: Production

