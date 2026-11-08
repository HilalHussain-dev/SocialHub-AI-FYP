# LinkedIn Integration - Quick Start Guide

## 🚀 Get Started in 5 Minutes

### Step 1: Get LinkedIn Credentials (2 minutes)

1. Visit https://www.linkedin.com/developers/apps/new
2. Fill in:
   - **App name**: SocialHub AI
   - **LinkedIn Page**: Your company page
3. Click "Create app"
4. Go to **"Auth"** tab
5. Copy:
   - **Client ID**: `78xxxxxxxxxxxxxx`
   - **Client Secret**: `zJ9xxxxxxxxxxxxx`

### Step 2: Configure Redirect URL (30 seconds)

In the LinkedIn App **"Auth"** tab, under **OAuth 2.0 settings**:

Add redirect URL:
```
http://localhost:8787/api/linkedin/callback
```

### Step 3: Request Required Products (1 minute)

In the **"Products"** tab, request:
- ✅ Sign In with LinkedIn using OpenID Connect
- ✅ Share on LinkedIn

*(Usually approved instantly for development)*

### Step 4: Add Credentials to Backend (30 seconds)

Edit `backend/.dev.vars`:
```env
LINKEDIN_CLIENT_ID=78xxxxxxxxxxxxxx
LINKEDIN_CLIENT_SECRET=zJ9xxxxxxxxxxxxx
LINKEDIN_REDIRECT_URI=http://localhost:8787/api/linkedin/callback
```

### Step 5: Run the App (1 minute)

```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend  
cd "front end"
npm run dev
```

### Step 6: Test It! (30 seconds)

1. Open http://localhost:8443
2. Login to SocialHub
3. Click the **LinkedIn icon** in the sidebar (or "Connect channels")
4. Click **LinkedIn** → Authorize
5. ✅ Connected! Try publishing a post

---

## 🎯 That's it! You're ready to go!

Need more details? Check out:
- **Full Guide**: `LINKEDIN_INTEGRATION_GUIDE.md`
- **Implementation Details**: `LINKEDIN_IMPLEMENTATION_SUMMARY.md`

---

## 📝 Quick Test Post

Once connected, try this in the post composer:

```
🚀 Just connected my LinkedIn account to SocialHub AI! 
Excited to streamline my social media workflow.

#SocialMedia #ProductivityTools #LinkedIn
```

Add an image for bonus points! 📸

---

## 🆘 Quick Troubleshooting

**Can't connect?**
- Check Client ID and Secret are correct
- Verify redirect URL matches exactly
- Make sure both servers are running

**Posts not publishing?**
- Check "Share on LinkedIn" product is approved
- Verify `w_member_social` scope is granted
- Re-connect account if needed

**Still stuck?**
- See `LINKEDIN_INTEGRATION_GUIDE.md` Section 7 (Common Issues)
- Check backend logs in terminal
- Verify D1 database with: `npx wrangler d1 execute socialhub-db --local --command="SELECT * FROM linkedin_accounts"`

---

## 🎉 You're All Set!

Your LinkedIn integration is complete. Start publishing amazing content! 🚀
