# LinkedIn Integration - Deployment Checklist

## ✅ Pre-Deployment Checklist

### LinkedIn Developer App Configuration
- [ ] LinkedIn App created at developers.linkedin.com
- [ ] App name and details filled out
- [ ] Client ID obtained
- [ ] Primary Client Secret obtained
- [ ] "Sign In with LinkedIn using OpenID Connect" product requested
- [ ] "Share on LinkedIn" product requested
- [ ] Products approved by LinkedIn

### Local Development URLs
- [ ] Redirect URI added: `http://localhost:8787/api/linkedin/callback`
- [ ] Tested OAuth flow locally
- [ ] Verified account connection works
- [ ] Tested text post publishing
- [ ] Tested image post publishing
- [ ] Confirmed posts appear in dashboard history

### Environment Variables (Local)
- [ ] `backend/.dev.vars` created
- [ ] `LINKEDIN_CLIENT_ID` set in .dev.vars
- [ ] `LINKEDIN_CLIENT_SECRET` set in .dev.vars
- [ ] `LINKEDIN_REDIRECT_URI` set in .dev.vars
- [ ] Backend starts without errors

### Database
- [ ] D1 database exists: `socialhub-db`
- [ ] Schema applied locally: `npx wrangler d1 execute socialhub-db --file=schema.sql --local`
- [ ] `linkedin_accounts` table created
- [ ] Foreign key to `users` table working
- [ ] Posts table accepts `channel='linkedin'`

### Backend Code
- [ ] `backend/src/services/linkedin.js` exists
- [ ] `backend/src/routes/linkedin.js` exists
- [ ] LinkedIn routes added to `backend/src/index.js`
- [ ] Schema updated in `backend/schema.sql`
- [ ] `.dev.vars.example` updated with LinkedIn variables

### Frontend Code
- [ ] `BufferDashboard.tsx` updated with LinkedIn state
- [ ] LinkedIn channel pill shows in composer
- [ ] LinkedIn publishing logic implemented
- [ ] `ConnectNewChannelModal.tsx` includes LinkedIn
- [ ] LinkedIn switcher modal added
- [ ] `App.tsx` handles `/linkedin/callback` route
- [ ] Channel count updated from 3 to 4

### Local Testing Complete
- [ ] Can connect LinkedIn account
- [ ] Account shows in dashboard
- [ ] Can switch between multiple accounts (if applicable)
- [ ] Can publish text posts
- [ ] Can publish image posts
- [ ] Posts save to D1 database
- [ ] Images save to R2 storage
- [ ] Post history displays correctly
- [ ] Error messages display appropriately

---

## 🚀 Production Deployment Checklist

### 1. Deploy Backend to Cloudflare Workers

```bash
cd backend

# Set production secrets
npx wrangler secret put LINKEDIN_CLIENT_ID
# Enter: 78xxxxxxxxxxxxxx

npx wrangler secret put LINKEDIN_CLIENT_SECRET
# Enter: zJ9xxxxxxxxxxxxx

npx wrangler secret put LINKEDIN_REDIRECT_URI
# Enter: https://your-worker.workers.dev/api/linkedin/callback

# Deploy
npm run deploy
```

**Verify:**
- [ ] Secrets set successfully
- [ ] Deployment completed without errors
- [ ] Worker URL obtained: `https://socialhub-backend.YOUR_SUBDOMAIN.workers.dev`

### 2. Update LinkedIn App Redirect URLs

In LinkedIn Developer Portal → Your App → Auth tab:

**Add Production Redirect URL:**
```
https://socialhub-backend.YOUR_SUBDOMAIN.workers.dev/api/linkedin/callback
```

**Verify:**
- [ ] Production redirect URL added
- [ ] URL saved successfully
- [ ] Both local and production URLs present

### 3. Apply D1 Database Schema (Production)

```bash
cd backend
npx wrangler d1 execute socialhub-db --file=schema.sql --remote
```

**Verify:**
- [ ] Schema applied successfully
- [ ] No errors reported
- [ ] Verify table exists:
```bash
npx wrangler d1 execute socialhub-db --remote --command="SELECT name FROM sqlite_master WHERE type='table' AND name='linkedin_accounts'"
```

### 4. Update Frontend Environment

Update frontend `.env.production` or build config:
```env
VITE_API_URL=https://socialhub-backend.YOUR_SUBDOMAIN.workers.dev
```

**Verify:**
- [ ] API URL points to production Worker
- [ ] No localhost references in production build

### 5. Deploy Frontend

```bash
cd "front end"

# Build
npm run build

# Deploy to your hosting (example: Cloudflare Pages)
npx wrangler pages deploy dist --project-name=socialhub
```

**Verify:**
- [ ] Build completed successfully
- [ ] Deployment completed
- [ ] Frontend URL obtained: `https://socialhub.pages.dev`

### 6. Update LinkedIn App Frontend URL

In LinkedIn Developer Portal → Your App:

**Update App Settings:**
- Website URL: `https://socialhub.pages.dev`
- Privacy Policy URL: `https://socialhub.pages.dev/privacy`
- Terms of Service URL: `https://socialhub.pages.dev/terms`

**Verify:**
- [ ] URLs updated
- [ ] Changes saved

### 7. Production Testing

**OAuth Flow:**
- [ ] Visit production site
- [ ] Login to SocialHub account
- [ ] Click "Connect LinkedIn"
- [ ] Redirected to LinkedIn authorization
- [ ] Authorize app
- [ ] Redirected back to dashboard
- [ ] Connection shows in UI

**Publishing:**
- [ ] Compose text post
- [ ] Select LinkedIn channel
- [ ] Publish successfully
- [ ] Verify post appears on LinkedIn
- [ ] Check post saved in dashboard history

**Image Publishing:**
- [ ] Upload image
- [ ] Add caption
- [ ] Select LinkedIn channel
- [ ] Publish successfully
- [ ] Verify image post on LinkedIn
- [ ] Confirm image saved to R2
- [ ] Check post history

**Multiple Accounts (if applicable):**
- [ ] Connect second LinkedIn account
- [ ] Switch between accounts
- [ ] Publish to both accounts
- [ ] Verify correct account used

### 8. Monitoring & Logs

**Cloudflare Dashboard:**
- [ ] Check Worker logs for errors
- [ ] Monitor request volume
- [ ] Check D1 database size
- [ ] Verify R2 storage usage

**LinkedIn Developer Dashboard:**
- [ ] Monitor API usage
- [ ] Check for rate limit warnings
- [ ] Verify app status is "Active"

---

## 🔍 Post-Deployment Verification

### Smoke Tests (5 minutes)

1. **Connection Test**
   ```
   ✓ User can connect LinkedIn account
   ✓ Account data displays correctly
   ✓ Connection persists after refresh
   ```

2. **Publishing Test**
   ```
   ✓ Text post publishes successfully
   ✓ Image post publishes successfully
   ✓ Posts appear on LinkedIn within 30 seconds
   ✓ Post history updates immediately
   ```

3. **Error Handling Test**
   ```
   ✓ OAuth cancellation handled gracefully
   ✓ Network errors show user-friendly messages
   ✓ Invalid tokens trigger re-authentication
   ```

### Database Verification

```bash
# Check connected accounts
npx wrangler d1 execute socialhub-db --remote --command="SELECT COUNT(*) FROM linkedin_accounts"

# Check recent posts
npx wrangler d1 execute socialhub-db --remote --command="SELECT * FROM posts WHERE channel='linkedin' ORDER BY created_at DESC LIMIT 5"
```

**Expected:**
- [ ] Accounts table has records
- [ ] Posts table has LinkedIn entries
- [ ] Timestamps are correct
- [ ] Foreign keys intact

### R2 Storage Verification

```bash
# List recent media files
npx wrangler r2 object list socialhub-media --limit 10
```

**Expected:**
- [ ] Images stored in `posts/` folder
- [ ] File names match database records
- [ ] Media accessible via CDN URLs

---

## 🚨 Rollback Plan (If Needed)

### Quick Rollback Steps

1. **Revert Backend Deployment**
   ```bash
   cd backend
   npx wrangler rollback
   ```

2. **Revert Frontend Deployment**
   ```bash
   cd "front end"
   npx wrangler pages deployment list
   npx wrangler pages deployment rollback <DEPLOYMENT_ID>
   ```

3. **Disable LinkedIn in UI** (Emergency)
   - Comment out LinkedIn channel pill in `BufferDashboard.tsx`
   - Redeploy frontend

4. **Remove LinkedIn Routes** (Last Resort)
   - Comment out LinkedIn routes in `backend/src/index.js`
   - Redeploy backend

---

## 📊 Success Metrics

### Week 1 Post-Launch
- [ ] ≥ 10 LinkedIn accounts connected
- [ ] ≥ 50 posts published
- [ ] < 5% error rate
- [ ] < 2 second average API response time
- [ ] Zero critical bugs reported

### Month 1 Post-Launch
- [ ] ≥ 100 LinkedIn accounts connected
- [ ] ≥ 500 posts published
- [ ] < 2% error rate
- [ ] User retention > 80%
- [ ] Positive user feedback

---

## 🎯 Launch Announcement

**Sample Tweet/Post:**
```
🎉 Exciting news! LinkedIn integration is now live in SocialHub AI! 

✨ Connect your LinkedIn profile
📝 Publish text & image posts
⚡ Manage multiple accounts
📊 Track all your posts in one place

Try it now → [your-site-url]

#LinkedIn #SocialMediaManagement #ProductLaunch
```

---

## ✅ Final Sign-Off

**Deployment Completed By:** ___________________  
**Date:** ___________________  
**Production URL:** ___________________  
**LinkedIn App ID:** ___________________  

**Tested & Verified By:** ___________________  
**Date:** ___________________  

---

## 🆘 Support Contacts

**Technical Issues:**
- Check logs: Cloudflare Dashboard → Workers → socialhub-backend → Logs
- Database issues: D1 Dashboard
- Storage issues: R2 Dashboard

**LinkedIn API Issues:**
- LinkedIn Developer Support: https://www.linkedin.com/help/linkedin/ask/api
- API Status: https://linkedinstatus.com/

**Documentation:**
- Implementation Guide: `LINKEDIN_INTEGRATION_GUIDE.md`
- Quick Start: `LINKEDIN_QUICK_START.md`
- Summary: `LINKEDIN_IMPLEMENTATION_SUMMARY.md`

---

## 🎊 Congratulations!

Your LinkedIn integration is now live in production! 🚀

Users can seamlessly connect their LinkedIn accounts and publish amazing content directly from SocialHub AI.

**What's Next?**
- Monitor usage and performance
- Gather user feedback
- Plan additional LinkedIn features
- Celebrate your successful launch! 🎉
