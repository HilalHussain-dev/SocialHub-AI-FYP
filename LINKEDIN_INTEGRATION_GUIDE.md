# LinkedIn Integration Guide for SocialHub AI

## Overview
Complete LinkedIn OAuth 2.0 integration enabling users to connect LinkedIn accounts and publish text and image posts to their LinkedIn profile.

---

## 1. LinkedIn Developer App Setup

### Step 1: Create LinkedIn App
1. Go to [LinkedIn Developer Portal](https://www.linkedin.com/developers/)
2. Click **"Create App"**
3. Fill in required information:
   - **App name**: SocialHub AI (or your app name)
   - **LinkedIn Page**: Associate with your LinkedIn Company Page
   - **App logo**: Upload your logo
   - **Legal agreement**: Accept the terms

### Step 2: Get Credentials
After creating the app, navigate to the **"Auth"** tab:
- **Client ID**: Copy this value
- **Primary Client Secret**: Copy this value (keep secure!)

### Step 3: Configure OAuth 2.0 Settings

#### Redirect URLs
Add the following redirect URLs in the **"Auth"** tab under **"OAuth 2.0 settings"**:

**For Local Development:**
```
http://localhost:8787/api/linkedin/callback
```

**For Production:**
```
https://your-worker-domain.workers.dev/api/linkedin/callback
https://yourdomain.com/api/linkedin/callback
```

#### Required Scopes
Request the following OAuth 2.0 scopes in the **"Products"** tab:

1. **Sign In with LinkedIn using OpenID Connect**
   - Scopes: `openid`, `profile`, `email`
   
2. **Share on LinkedIn**
   - Scope: `w_member_social`

**Note**: You may need to request access to these products. LinkedIn typically approves standard integrations quickly.

---

## 2. Backend Configuration

### Update Environment Variables

#### Local Development (`.dev.vars`)
Create or update `backend/.dev.vars`:

```env
# LinkedIn App Credentials (from developer.linkedin.com)
LINKEDIN_CLIENT_ID=your_client_id_here
LINKEDIN_CLIENT_SECRET=your_primary_client_secret_here
LINKEDIN_REDIRECT_URI=http://localhost:8787/api/linkedin/callback
```

#### Production (Cloudflare Secrets)
Set secrets using Wrangler CLI:

```bash
cd backend

# Set LinkedIn credentials
npx wrangler secret put LINKEDIN_CLIENT_ID
# Paste your Client ID when prompted

npx wrangler secret put LINKEDIN_CLIENT_SECRET
# Paste your Primary Client Secret when prompted

npx wrangler secret put LINKEDIN_REDIRECT_URI
# Enter: https://your-worker-domain.workers.dev/api/linkedin/callback
```

### Database Migration

The `linkedin_accounts` table is automatically created on first use. To manually create it, run:

```sql
CREATE TABLE IF NOT EXISTS linkedin_accounts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    linkedin_id TEXT NOT NULL,
    linkedin_urn TEXT NOT NULL,
    name TEXT,
    email TEXT,
    profile_picture TEXT,
    access_token TEXT NOT NULL,
    token_expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, linkedin_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

Or apply the full schema:

```bash
cd backend
npx wrangler d1 execute socialhub-db --file=schema.sql --local    # Local
npx wrangler d1 execute socialhub-db --file=schema.sql --remote   # Production
```

---

## 3. API Endpoints

### LinkedIn OAuth Flow

#### 1. Initiate OAuth
**Endpoint**: `GET /api/linkedin/auth`  
**Aliases**: `/api/auth/linkedin/connect`, `/api/auth/linkedin`

**Query Parameters**:
- `origin` (optional): Frontend origin for redirect after OAuth

**Response**: Redirects to LinkedIn OAuth authorization page

**Example**:
```
http://localhost:8787/api/linkedin/auth?origin=http://localhost:8443
```

---

#### 2. OAuth Callback
**Endpoint**: `GET /api/linkedin/callback`  
**Aliases**: `/api/auth/linkedin/callback`

**Query Parameters** (from LinkedIn):
- `code`: Authorization code
- `state`: State parameter for security

**Response**: Redirects to frontend with connection status

**Success Redirect**:
```
http://localhost:8443/linkedin/callback?platform=linkedin&success=true&name=John%20Doe&accountId=abc123&email=john@example.com
```

**Error Redirect**:
```
http://localhost:8443/linkedin/callback?error=Authorization%20failed
```

---

### Account Management

#### 3. Get Connected Accounts
**Endpoint**: `GET /api/linkedin/accounts`  
**Aliases**: `/api/auth/linkedin/accounts`

**Headers**:
- `Cookie: session_token=...` (required)

**Response**:
```json
{
  "success": true,
  "accounts": [
    {
      "id": "uuid",
      "linkedin_id": "abc123",
      "linkedin_urn": "urn:li:person:abc123",
      "name": "John Doe",
      "email": "john@example.com",
      "profile_picture": "https://...",
      "updated_at": "2026-11-08T...",
      "created_at": "2026-11-01T..."
    }
  ]
}
```

---

#### 4. Activate Account
**Endpoint**: `POST /api/linkedin/accounts/activate`

**Headers**:
- `Content-Type: application/json`
- `Cookie: session_token=...`

**Request Body**:
```json
{
  "accountId": "abc123"
}
```

**Response**:
```json
{
  "success": true,
  "account": {
    "id": "uuid",
    "linkedin_id": "abc123",
    "linkedin_urn": "urn:li:person:abc123",
    "name": "John Doe",
    "email": "john@example.com"
  }
}
```

---

### Publishing Posts

#### 5. Publish Text Post
**Endpoint**: `POST /api/linkedin/post`  
**Aliases**: `/api/auth/linkedin/post`

**Headers**:
- `Content-Type: application/json`
- `Cookie: session_token=...`

**Request Body**:
```json
{
  "accountId": "abc123",
  "message": "Excited to announce our new product launch! 🚀"
}
```

**Response**:
```json
{
  "success": true,
  "type": "text",
  "message": "Post published successfully to LinkedIn!",
  "postId": "urn:li:share:6789...",
  "savedToR2": false,
  "savedToDatabase": true
}
```

---

#### 6. Publish Image Post

**Option A: Multipart Form Data** (recommended for file uploads)

**Headers**:
- `Content-Type: multipart/form-data`
- `Cookie: session_token=...`

**Form Fields**:
- `accountId`: LinkedIn account ID (optional, uses active account)
- `message`: Post text
- `image`: Image file (File object)

**Example (JavaScript)**:
```javascript
const formData = new FormData();
formData.append('accountId', 'abc123');
formData.append('message', 'Check out this amazing photo!');
formData.append('image', imageFile);

const response = await fetch('http://localhost:8787/api/linkedin/post', {
  method: 'POST',
  credentials: 'include',
  body: formData
});
```

---

**Option B: JSON with Base64 Image**

**Headers**:
- `Content-Type: application/json`
- `Cookie: session_token=...`

**Request Body**:
```json
{
  "accountId": "abc123",
  "message": "Check out this amazing photo!",
  "imageBase64": "data:image/jpeg;base64,/9j/4AAQSkZJRg..."
}
```

**Response**:
```json
{
  "success": true,
  "type": "image",
  "message": "Image post published successfully to LinkedIn!",
  "postId": "urn:li:share:6789...",
  "mediaKey": "posts/user123/uuid-image.jpg",
  "mediaUrl": "http://localhost:8787/api/media/posts%2Fuser123%2Fuuid-image.jpg",
  "savedToR2": true,
  "savedToDatabase": true
}
```

---

## 4. Frontend Integration

### Connect LinkedIn Account

```typescript
// Redirect to LinkedIn OAuth
window.location.href = `${apiUrl}/api/auth/linkedin/connect`;
```

### Handle OAuth Callback

```typescript
// In your callback route handler (e.g., /linkedin/callback)
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const success = params.get('success');
  const error = params.get('error');
  const name = params.get('name');
  const accountId = params.get('accountId');
  
  if (success === 'true') {
    console.log(`LinkedIn account connected: ${name}`);
    // Reload connected accounts
    loadLinkedInAccounts();
    // Navigate back to dashboard
    navigate('/dashboard');
  } else if (error) {
    console.error(`LinkedIn connection failed: ${error}`);
    alert(`Failed to connect LinkedIn: ${error}`);
  }
}, []);
```

### Fetch Connected Accounts

```typescript
async function loadLinkedInAccounts() {
  const response = await fetch(`${apiUrl}/api/linkedin/accounts`, {
    credentials: 'include'
  });
  
  if (response.ok) {
    const data = await response.json();
    setLinkedInAccounts(data.accounts || []);
  }
}
```

### Publish a Post

```typescript
async function publishToLinkedIn(accountId, message, imageFile = null) {
  let response;
  
  if (imageFile) {
    // Publish with image
    const formData = new FormData();
    formData.append('accountId', accountId);
    formData.append('message', message);
    formData.append('image', imageFile);
    
    response = await fetch(`${apiUrl}/api/linkedin/post`, {
      method: 'POST',
      credentials: 'include',
      body: formData
    });
  } else {
    // Text-only post
    response = await fetch(`${apiUrl}/api/linkedin/post`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ accountId, message })
    });
  }
  
  const data = await response.json();
  
  if (data.success) {
    console.log('Published to LinkedIn:', data.postId);
    return data;
  } else {
    throw new Error(data.error || 'Failed to publish to LinkedIn');
  }
}
```

---

## 5. Testing

### Local Testing

1. **Start the backend**:
```bash
cd backend
npm run dev
```

2. **Start the frontend**:
```bash
cd "front end"
npm run dev
```

3. **Test the flow**:
   - Navigate to `http://localhost:8443`
   - Login to your SocialHub account
   - Click "Connect LinkedIn" in the dashboard
   - Authorize the app on LinkedIn
   - Return to dashboard and verify connection
   - Try publishing a text post
   - Try publishing an image post

### Verify Database

```bash
# Local D1 database
cd backend
npx wrangler d1 execute socialhub-db --local --command="SELECT * FROM linkedin_accounts"

# Production D1 database
npx wrangler d1 execute socialhub-db --remote --command="SELECT * FROM linkedin_accounts"
```

### Check Post History

```bash
npx wrangler d1 execute socialhub-db --local --command="SELECT * FROM posts WHERE channel='linkedin' ORDER BY created_at DESC LIMIT 10"
```

---

## 6. Deployment

### Deploy Backend

```bash
cd backend

# Deploy to Cloudflare Workers
npm run deploy

# Verify deployment
curl https://your-worker-domain.workers.dev/api/health
```

### Update LinkedIn App Settings

After deploying, update your LinkedIn App's redirect URLs to include production URL:

```
https://your-worker-domain.workers.dev/api/linkedin/callback
```

### Deploy Frontend

```bash
cd "front end"

# Build for production
npm run build

# Deploy to your hosting (Cloudflare Pages, Vercel, etc.)
```

---

## 7. Common Issues & Solutions

### Issue: "LINKEDIN_CLIENT_ID is not configured"
**Solution**: Ensure you've set `LINKEDIN_CLIENT_ID` in `.dev.vars` (local) or as a Cloudflare secret (production).

```bash
# Check local .dev.vars file
cat backend/.dev.vars

# Set production secret
npx wrangler secret put LINKEDIN_CLIENT_ID
```

---

### Issue: "Authorization code is missing"
**Solution**: LinkedIn didn't return an authorization code. Check:
1. Redirect URI matches exactly what's configured in LinkedIn App
2. User completed the authorization flow
3. App has required permissions/products enabled

---

### Issue: "Failed to exchange token with LinkedIn"
**Solution**: 
- Verify `LINKEDIN_CLIENT_SECRET` is correct
- Check that redirect URI used in exchange matches the one from authorization
- Ensure authorization code hasn't expired (valid for 30 seconds)

---

### Issue: "Failed to retrieve LinkedIn user profile"
**Solution**:
- Verify app has "Sign In with LinkedIn" product enabled
- Check that access token is valid
- Ensure scopes include `openid`, `profile`, and `email`

---

### Issue: "Failed to publish LinkedIn post"
**Solution**:
- Verify app has "Share on LinkedIn" product enabled
- Check that `w_member_social` scope is granted
- Ensure access token hasn't expired
- For image posts, verify image format is supported (JPEG, PNG)

---

### Issue: LinkedIn API returns 403 Forbidden
**Solution**:
- App may not have required products approved
- Access token may be invalid or expired
- User may have revoked app permissions
- Re-authenticate the user to get a fresh token

---

## 8. LinkedIn API Limits

### Rate Limits
- **User Posts**: 100 posts per day per user
- **API Calls**: Varies by product and access level
- Monitor rate limit headers in responses

### Content Limits
- **Post Text**: 3,000 characters maximum
- **Image Size**: 10 MB maximum
- **Supported Formats**: JPEG, PNG

### Token Expiration
- **Access Token**: 60 days (if not refreshed)
- **Refresh Token**: LinkedIn OAuth 2.0 uses long-lived tokens
- Store `token_expires_at` and implement refresh logic if needed

---

## 9. Security Best Practices

1. **Never expose secrets in frontend code**
   - Client ID can be public, but keep Client Secret secure
   - Store secrets in Cloudflare Workers environment

2. **Validate state parameter**
   - OAuth state cookie is used to prevent CSRF attacks
   - Always validate state matches between request and callback

3. **Use HTTPS in production**
   - LinkedIn requires HTTPS for production redirect URIs
   - Cloudflare Workers provide HTTPS by default

4. **Implement token refresh**
   - Monitor token expiration
   - Re-authenticate users when tokens expire

5. **Handle errors gracefully**
   - Display user-friendly error messages
   - Log detailed errors server-side for debugging

---

## 10. Support & Resources

### LinkedIn Developer Resources
- [LinkedIn Developer Portal](https://www.linkedin.com/developers/)
- [OAuth 2.0 Documentation](https://docs.microsoft.com/en-us/linkedin/shared/authentication/authentication)
- [Share on LinkedIn API](https://docs.microsoft.com/en-us/linkedin/marketing/integrations/community-management/shares/share-api)
- [LinkedIn API Terms of Use](https://legal.linkedin.com/api-terms-of-use)

### SocialHub AI Code
- Backend Service: `backend/src/services/linkedin.js`
- Backend Routes: `backend/src/routes/linkedin.js`
- Frontend Integration: `front end/src/components/admin/BufferDashboard.tsx`
- Modal Component: `front end/src/components/admin/ConnectNewChannelModal.tsx`

---

## 11. Architecture Summary

### OAuth 2.0 Flow
```
User clicks "Connect LinkedIn"
  ↓
Frontend redirects to /api/linkedin/auth
  ↓
Backend redirects to LinkedIn OAuth (with state parameter)
  ↓
User authorizes app on LinkedIn
  ↓
LinkedIn redirects to /api/linkedin/callback with code
  ↓
Backend exchanges code for access token
  ↓
Backend fetches user profile from LinkedIn API
  ↓
Backend stores account in D1 database (linkedin_accounts table)
  ↓
Backend redirects to frontend with success
  ↓
Frontend displays connected account
```

### Publishing Flow
```
User composes post with text/image
  ↓
Frontend sends POST to /api/linkedin/post
  ↓
Backend retrieves active LinkedIn account from D1
  ↓
If image: Backend uploads image to LinkedIn via Images API
  ↓
Backend creates post via UGC Posts API
  ↓
Backend saves post history to D1 (posts table)
  ↓
Backend saves media to R2 (if image)
  ↓
Backend returns success to frontend
  ↓
Frontend displays success message
```

---

## Congratulations! 🎉

Your LinkedIn integration is now complete. Users can:
✅ Connect LinkedIn accounts via OAuth 2.0
✅ Publish text posts to LinkedIn
✅ Publish image posts to LinkedIn
✅ Manage multiple LinkedIn accounts
✅ View post history in dashboard

For questions or issues, refer to the code comments or LinkedIn API documentation.
