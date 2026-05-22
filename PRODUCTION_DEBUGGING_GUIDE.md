# 🔧 Production Debugging Guide

**For troubleshooting issues in production Render deployment**

---

## 🚨 Emergency Procedures

### Service is Completely Down

**Step 1: Initial Diagnosis (1 minute)**
```bash
# 1. Check service status
curl https://car-rental-api-xxxxx.onrender.com/health

# 2. Check if service is running
# Render Dashboard → Services → car-rental-backend → Status

# 3. Check recent logs for errors
# Render Dashboard → Logs (view last 100 lines)
```

**Step 2: Quick Fix Attempts (2-5 minutes)**
```bash
# Option A: Restart service
# Render Dashboard → Service → Settings → Restart instance
# (Wait 30-60 seconds for restart)

# Option B: Manual redeploy
# Render Dashboard → Deployments → Deploy latest commit

# Option C: Revert to previous version
# Render Dashboard → Deployments → Click previous → Redeploy
```

**Step 3: Investigate Root Cause (5-15 minutes)**
```bash
# Check if it's external service issue:
1. MongoDB Atlas status: https://status.mongodb.com
2. Stripe status: https://status.stripe.com
3. Cloudinary status: https://status.cloudinary.com
4. Brevo status: https://status.brevo.com

# Check database connectivity
mongosh "your-connection-string"
  db.admin.ping()

# Check Render metrics
Render Dashboard → Metrics → CPU, Memory, Disk
```

---

## 🔍 Debugging By Symptoms

### Symptom 1: 500 Internal Server Error

```
HTTP/1.1 500 Internal Server Error
{"success":false,"error":"INTERNAL_ERROR","message":"..."}
```

**Debug Steps:**

1. **Check logs for error stack trace**
   ```
   Render Dashboard → Logs → Filter ERROR
   Look for: [ERROR] or "error": message
   ```

2. **Common causes and fixes:**

   a) Database connection error
   ```
   Error: MongoNetworkError: connection 0 to ...
   
   Fix:
   1. mongosh "connection-string" (test locally)
   2. Check MongoDB Atlas network access
   3. Verify DATABASE_URL is correct
   4. Ensure password is URL-encoded
   ```

   b) Missing environment variable
   ```
   Error: Cannot read property of undefined (reading 'something')
   Error: process.env.STRIPE_SECRET_KEY is not defined
   
   Fix:
   1. List all env vars: Render → Environment
   2. Add missing variable
   3. Verify spelling (case-sensitive)
   4. Redeploy
   ```

   c) Stripe API error
   ```
   Error: Invalid API Key provided: sk_test_...
   
   Fix:
   1. Verify STRIPE_SECRET_KEY is sk_live_ (not sk_test_)
   2. Check key is correct (copy-paste again)
   3. Verify key is for Live mode (not Test mode)
   ```

   d) Cloudinary error
   ```
   Error: Invalid Cloud Name
   
   Fix:
   1. Verify CLOUDINARY_CLOUD_NAME in env vars
   2. Check it matches Cloudinary Dashboard
   3. Test locally: 
      const cloudinary = require('cloudinary').v2;
      cloudinary.config({...});
      cloudinary.api.resources().then(console.log);
   ```

3. **Get full error details:**
   ```bash
   # Enable verbose logging temporarily
   Render → Environment → Add LOG_LEVEL=debug
   Redeploy
   Re-trigger error
   Check logs
   Revert LOG_LEVEL to info
   ```

---

### Symptom 2: 502 Bad Gateway

```
HTTP/1.1 502 Bad Gateway
<html><body><h1>502 Bad Gateway</h1></body></html>
```

**This usually means the Node.js service crashed or won't start**

**Debug Steps:**

1. **Check service logs for startup errors**
   ```
   Render → Logs → Recent lines show:
   - npm install errors
   - Build command failures
   - Database connection timeout
   - Port binding issues
   ```

2. **Common causes:**

   a) Failed npm install
   ```
   Error: npm ERR! code ERESOLVE
   Error: unable to resolve dependency tree
   
   Fix:
   1. Locally: npm ci && npm install
   2. Test: npm start
   3. Push to GitHub
   4. Render auto-redeploys
   ```

   b) Build command error
   ```
   Error: prisma db push failed
   Error: npm run db:generate failed
   
   Fix:
   1. Verify database connection works
   2. Test build locally:
      cd backend && npm ci && npm run db:generate
   3. If fails, check prisma/schema.prisma syntax
   4. Update DATABASE_URL if needed
   ```

   c) Port already in use
   ```
   Error: EADDRINUSE: address already in use :::5000
   
   Fix:
   1. Ensure PORT env var is set to 5000
   2. Restart service from Render Dashboard
   3. Service should automatically use PORT from env
   ```

   d) Memory limit exceeded
   ```
   Error: JavaScript heap out of memory
   
   Fix:
   1. Check for memory leaks in code
   2. Review heap dump
   3. Upgrade instance type (Render Dashboard)
   4. Enable garbage collection: node --expose-gc
   ```

3. **Recovery:**
   ```bash
   # Restart service
   Render → Service → Restart
   
   # Or rollback if recent change
   Render → Deployments → Previous → Redeploy
   
   # Or clear and rebuild
   Render → Build and deploy → Manual
   ```

---

### Symptom 3: Timeout / Slow Response (>10 seconds)

```
HTTP/1.1 504 Gateway Timeout
or
HTTP/1.1 200 OK (but takes 30+ seconds)
```

**Debug Steps:**

1. **Check which endpoint is slow**
   ```
   Frontend error: Which request timed out?
   Check browser Network tab for slow request
   ```

2. **Check server metrics**
   ```
   Render → Metrics
   Look for: High CPU, High Memory, Disk pressure
   ```

3. **Check database performance**
   ```
   MongoDB Atlas → Metrics
   Look for: Slow queries, High latency
   
   # Check specific query
   mongosh "connection-string"
    db.Booking.find({...}).explain("executionStats")
   ```

4. **Common slow operations:**

   a) Large data query without pagination
   ```
   Fix: Add limit/skip
   GET /api/v1/bookings?limit=10&skip=0
   ```

   b) Missing database index
   ```
   # Check indexes
   mongosh "connection-string"
    db.Booking.getIndexes()
   
   # Add index
   db.Booking.createIndex({ userId: 1 })
   ```

   c) N+1 query problem
   ```
   # Booking query fetches 100 bookings, then 100 separate user queries
   Fix: Use Prisma include
   prisma.booking.findMany({
     include: { user: true, car: true }
   })
   ```

   d) External API call is slow
   ```
   If Stripe/Cloudinary/Brevo API is slow:
   1. Make call async (don't wait)
   2. Cache results if possible
   3. Add timeout
   ```

5. **Profiling:**
   ```bash
   # Identify slowest endpoints
   Render → Logs → Filter slow requests
   
   # Check response times
   Look for: "responseTime: 25000" (25 seconds)
   
   # Optimize that endpoint
   ```

---

### Symptom 4: Memory Usage Growing / OOM Kill

```
Service restarts with exit code: 137 (OOM Kill)
Render → Metrics shows Memory climbing
Service becomes sluggish then crashes
```

**Debug Steps:**

1. **Check heap dump**
   ```bash
   # Enable heap snapshots
   npm install --save-dev node-inspect-native
   
   # Get heap info
   Render → Logs → Look for:
   "heap size: 512MB / 1024MB"
   ```

2. **Common memory leaks:**

   a) Connection pool not releasing
   ```
   Fix: Ensure Prisma connections are released
   Ensure Redis connections are closed
   ```

   b) Large objects staying in memory
   ```
   Fix: Implement proper cleanup
   Use generators for large datasets
   Implement pagination
   ```

   c) Event listeners not removed
   ```
   Fix: Remove event listeners when done
   ee.removeListener('event', handler)
   ```

3. **Temporary fix:**
   ```
   Render → Instance type → Upgrade to larger instance
   (Gives more RAM while you fix the leak)
   ```

4. **Permanent fix:**
   ```
   Find memory leak:
   1. Restart service with garbage collection exposed
   2. Monitor memory growth
   3. Create heap dump at peak
   4. Analyze dump for retained objects
   5. Fix root cause
   6. Test locally before deploying
   ```

---

### Symptom 5: Database Connection Failures

```
Error: MongoNetworkError
Error: connect ETIMEDOUT
Error: authentication failed
```

**Debug Steps:**

1. **Verify connection string**
   ```bash
   # Check DATABASE_URL in Render → Environment
   Should look like:
   mongodb+srv://user:pass@cluster.mongodb.net/db?retryWrites=true&w=majority
   
   # Common mistakes:
   - Wrong password (special chars need %encoding)
   - Typo in username
   - Typo in cluster name
   - Missing database name
   ```

2. **Test connection locally**
   ```bash
   mongosh "your-connection-string"
   
   If fails locally, issue is with credentials/connection string
   If works locally, issue is with network access
   ```

3. **Check MongoDB Atlas network access**
   ```
   MongoDB Atlas → Network Access
   
   Should have IP for Render:
   - Option A: 0.0.0.0/0 (allow all - for dev only)
   - Option B: Add Render IPs:
     3.121.23.0/24 (Frankfurt)
     34.212.183.0/24 (US)
   ```

4. **Check database user**
   ```
   MongoDB Atlas → Database Access
   
   Verify:
   - User exists (car_rental_prod_user)
   - User has "Atlas admin" role
   - Password matches CONNECTION_STRING
   - User hasn't been deleted
   ```

5. **Check cluster status**
   ```
   MongoDB Atlas → Clusters
   
   Status should be: "Active"
   Not: "Paused", "Terminating", "Creating"
   ```

6. **Fix connection issues:**

   a) Check IP whitelist
   ```
   Render → IP Address (if visible)
   Add to MongoDB Atlas → Network Access
   ```

   b) URL-encode special characters
   ```
   Password: MyP@ssw0rd!
   Encoded: MyP%40ssw0rd%21
   
   Use URL encoder: https://www.urlencoder.org
   ```

   c) Verify appName parameter
   ```
   DATABASE_URL should end with:
   ?retryWrites=true&w=majority&appName=CarRentalProd
   ```

---

### Symptom 6: Stripe Webhook Failures

```
Webhooks not triggering
Payment doesn't create booking
Error: Signature verification failed
```

**Debug Steps:**

1. **Verify webhook endpoint**
   ```
   Stripe Dashboard → Developers → Webhooks
   
   Endpoint URL should be exactly:
   https://car-rental-api-xxxxx.onrender.com/api/v1/payments/webhook
   ```

2. **Check webhook secret**
   ```
   Render → Environment → STRIPE_WEBHOOK_SECRET
   
   Should match Stripe Dashboard → Webhooks → Signing secret
   Should start with: whsec_
   NOT: pk_ or sk_
   ```

3. **Test webhook manually**
   ```bash
   # Using Stripe CLI
   stripe listen --forward-to https://your-api/api/v1/payments/webhook
   stripe trigger payment_intent.succeeded
   
   # Check logs for webhook processing
   Render → Logs → Look for [WEBHOOK]
   ```

4. **Check webhook events in Stripe**
   ```
   Stripe Dashboard → Developers → Webhooks
   Click endpoint → Recent events
   
   Shows:
   - Event sent
   - Response from your API
   - Any errors
   ```

5. **Fix webhook issues:**

   a) Raw body parser issue
   ```
   Error in logs: unexpected end of JSON input
   
   Fix: Webhook route uses express.raw({type: 'application/json'})
   Verify in backend/src/routes/payment.routes.js
   ```

   b) Signature verification fails
   ```
   Error: Webhook signature verification failed
   
   Fix:
   1. Check STRIPE_WEBHOOK_SECRET is correct
   2. Verify secret hasn't been regenerated in Stripe
   3. Ensure Stripe-Signature header is present
   4. Check request body is raw (not parsed as JSON)
   ```

   c) Webhook processing fails (200 OK but doesn't create booking)
   ```
   Error: No error, but booking not created
   
   Fix:
   1. Check logs: [WEBHOOK] Processing payment_intent.succeeded
   2. Check if payment_intent.metadata is set
   3. Verify booking creation isn't catching errors silently
   4. Check database for booking record
   ```

6. **Manual webhook retry**
   ```
   Stripe Dashboard → Webhooks → Click endpoint
   View recent events → Click event → Retry
   
   This manually sends the webhook again
   ```

---

### Symptom 7: Email Not Sending

```
Users not receiving welcome/confirmation emails
No error in logs
```

**Debug Steps:**

1. **Check Brevo credentials**
   ```
   Render → Environment → Check:
   - SMTP_HOST: smtp-relay.brevo.com
   - SMTP_PORT: 587
   - SMTP_SECURE: false
   - SMTP_USER: your-email@brevo.com
   - SMTP_PASS: xsmtpsib-xxx (API key, not password)
   ```

2. **Check sender email**
   ```
   Brevo Dashboard → Senders & Lists → Senders
   
   Verify:
   - Sender email is verified
   - Click confirmation link in email
   ```

3. **Check rate limits**
   ```
   Brevo Dashboard → Activity
   
   Free tier: 300 emails/day
   If limit exceeded, emails won't send
   
   Solution: Wait for next day or upgrade
   ```

4. **Check logs for email send**
   ```
   Render → Logs → Filter for MAILER
   
   Look for:
   [MAILER] ✅ Email sent (success)
   [MAILER] ❌ Final failure (error)
   [MAILER] ⚠️ Attempt N (retry)
   ```

5. **Test email sending**
   ```bash
   # Register test user (triggers welcome email)
   curl -X POST https://your-api/api/v1/auth/register \
     -H "Content-Type: application/json" \
     -d '{
       "name": "Test",
       "email": "youremail@example.com",
       "password": "Test123!"
     }'
   
   # Check your inbox (wait 5-10 seconds)
   # If not received, check spam folder
   # Check Brevo Activity log
   ```

6. **Fix email issues:**

   a) Authentication failed
   ```
   Error: Invalid credentials
   
   Fix:
   1. SMTP_PASS must be Brevo API Key (not password)
   2. Re-generate API key in Brevo if needed
   3. Ensure no extra spaces/characters
   ```

   b) Sender email not verified
   ```
   Error: 550 Message rejected
   
   Fix:
   1. Go to Brevo → Senders & Lists → Senders
   2. Verify sender email (click confirmation link)
   3. Wait for verification
   4. Retry sending
   ```

   c) Rate limit exceeded
   ```
   Error: 421 Service not available
   
   Fix:
   1. Check daily limit in Brevo
   2. Upgrade to paid plan
   3. Or batch emails for next day
   ```

---

### Symptom 8: High CPU/Memory in Metrics

```
Render → Metrics shows:
- CPU usage: 90%
- Memory usage: 85%
- Response times increasing
```

**Debug Steps:**

1. **Identify resource hog**
   ```bash
   # Check current requests
   curl https://your-api/health?verbose=true
   
   # Check logs for slow operations
   Render → Logs → Look for slow endpoints
   ```

2. **Common causes:**

   a) Too many requests
   ```
   Fix: Enable rate limiting
   Already enabled: 100 requests/min per IP
   
   If still high, add more aggressive limits:
   backend/src/app.js → adjust `max: 100`
   ```

   b) Large database query
   ```
   Fix: Add pagination
   GET /api/v1/bookings?limit=50&skip=0
   ```

   c) Stuck process/connection
   ```
   Fix: Restart service
   Render → Service → Restart
   ```

3. **Long-term solution:**
   ```
   1. Profile slow endpoints
   2. Add database indexes
   3. Implement caching
   4. Upgrade instance type
   ```

---

## 🧪 Testing & Validation

### Complete Health Check

```bash
#!/bin/bash
# Save as test-production.sh

API="https://car-rental-api-xxxxx.onrender.com"
echo "Testing: $API"

# 1. Health check
echo -n "Health check... "
HEALTH=$(curl -s $API/health | jq -r '.status')
if [ "$HEALTH" = "ok" ]; then echo "✅"; else echo "❌ $HEALTH"; fi

# 2. Get cars
echo -n "Get cars... "
CARS=$(curl -s $API/api/v1/cars | jq '.data | length')
echo "✅ $CARS cars found"

# 3. Register
echo -n "Register... "
REG=$(curl -s -X POST $API/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test'$RANDOM'@example.com","password":"Test123!"}' \
  | jq -r '.success')
if [ "$REG" = "true" ]; then echo "✅"; else echo "❌"; fi

# 4. CORS check
echo -n "CORS... "
CORS=$(curl -s -H "Origin: https://yourdomain.com" \
  -H "Access-Control-Request-Method: POST" \
  -X OPTIONS $API/api/v1/auth/login \
  | grep "Access-Control-Allow-Origin" | wc -l)
if [ "$CORS" -gt 0 ]; then echo "✅"; else echo "❌"; fi

echo "Done!"
```

### Database Validation

```bash
# Connect to MongoDB
mongosh "your-connection-string"

# Check collections exist
show collections

# Check user count
db.User.countDocuments()

# Check recent bookings
db.Booking.find().sort({createdAt: -1}).limit(5)

# Check indexes
db.Booking.getIndexes()

# Check database size
db.stats()
```

---

## 📋 Debugging Checklist

Before escalating, verify:

- [ ] Checked Render service status and logs
- [ ] Checked external service status pages
- [ ] Verified all environment variables are set
- [ ] Verified no recent code changes introduced issue
- [ ] Tested locally if possible
- [ ] Tried restarting service
- [ ] Checked database connectivity
- [ ] Reviewed error logs for stack trace
- [ ] Checked metrics (CPU, Memory, Disk)
- [ ] Verified firewall/network access
- [ ] Tested with fresh credentials if possible
- [ ] Reviewed rate limiting settings
- [ ] Checked for memory leaks
- [ ] Attempted rollback to previous version

---

## 📞 Getting Help

When escalating, provide:

1. **Error message** (full stack trace if available)
2. **Service logs** (last 50-100 lines from Render)
3. **When it started** (date, time, timezone)
4. **Reproducible steps** (if applicable)
5. **Recent changes** (code, dependencies, config)
6. **Metrics snapshot** (CPU, Memory, Requests from Render)
7. **External service status** (Stripe, MongoDB, etc.)

---

## 🔗 Resources

- Render Status: https://status.render.com
- MongoDB Status: https://status.mongodb.com
- Stripe Status: https://status.stripe.com
- Brevo Status: https://status.brevo.com
- Cloudinary Status: https://status.cloudinary.com

---

**Version**: 1.0  
**Last Updated**: May 23, 2026  
**Environment**: Production Render
