import {
    exchangeInstagramCodeForUserToken,
    getInstagramBusinessAccounts,
    getInstagramAccountDetails,
    publishInstagramPhotoPost,
} from "../services/instagram.js";
import { getSessionCookie } from "../utils/auth.js";
import { withCors } from "../utils/cors.js";

const META_OAUTH_URL = "https://www.facebook.com/v24.0/dialog/oauth";
const DEFAULT_FRONTEND_URL = "http://localhost:8443";

// Permissions active in your Meta App Dashboard for Instagram Business
const INSTAGRAM_SCOPES = [
    "instagram_basic",
    "instagram_content_publish",
    "instagram_manage_comments",
    "instagram_manage_messages",
    "pages_show_list",
    "pages_read_engagement",
    "public_profile",
];

function getBackendCallbackUrl(request, env) {
    const url = new URL(request.url);
    const queryRedirect = url.searchParams.get("redirect_uri") || url.searchParams.get("callback_url");
    if (queryRedirect) {
        return queryRedirect;
    }
    if (env.INSTAGRAM_REDIRECT_URI) {
        return env.INSTAGRAM_REDIRECT_URI;
    }

    const clientOrigin = request.headers.get("origin") || request.headers.get("referer") || url.searchParams.get("origin") || "";
    if (clientOrigin.includes("localhost") || clientOrigin.includes("127.0.0.1") || url.hostname === "localhost") {
        return "http://localhost:8787/api/instagram/callback";
    }

    return "http://localhost:8787/api/instagram/callback";
}

function createStateCookie(state) {
    return [
        `instagram_oauth_state=${encodeURIComponent(state)}`,
        "HttpOnly",
        "Path=/",
        "SameSite=Lax",
        "Max-Age=600",
    ].join("; ");
}

function getCookie(request, name) {
    const cookieHeader = request.headers.get("Cookie") || "";
    const cookies = cookieHeader.split(";").map((c) => c.trim());
    for (const cookie of cookies) {
        const [key, ...valueParts] = cookie.split("=");
        if (key === name) {
            return decodeURIComponent(valueParts.join("="));
        }
    }
    return null;
}

async function resolveUserId(request, env) {
    const requestUrl = new URL(request.url);
    const sessionToken = getSessionCookie(request) || requestUrl.searchParams.get("token");

    if (sessionToken) {
        const session = await env.socialhub_db
            .prepare("SELECT user_id, expires_at FROM sessions WHERE session_token = ?")
            .bind(sessionToken)
            .first();
        if (session && new Date(session.expires_at) >= new Date()) {
            return session.user_id;
        }
    }

    const paramUserId = requestUrl.searchParams.get("user_id");
    if (paramUserId) {
        const u = await env.socialhub_db.prepare("SELECT id FROM users WHERE id = ?").bind(paramUserId).first();
        if (u) return u.id;
    }

    // Fallback to most recently active user
    const lastUser = await env.socialhub_db
        .prepare("SELECT id FROM users ORDER BY last_login_at DESC, created_at DESC LIMIT 1")
        .first();
    if (lastUser) {
        return lastUser.id;
    }

    return null;
}

/**
 * GET /api/instagram/auth
 * Initiates Meta / Instagram OAuth
 */
export async function instagramAuth(request, env) {
    const requestUrl = new URL(request.url);
    const userId = await resolveUserId(request, env);

    if (!userId) {
        return withCors(new Response(
            JSON.stringify({ success: false, error: "Please log in first before connecting Instagram." }),
            { status: 401, headers: { "Content-Type": "application/json" } }
        ), request);
    }

    try {
        let frontendOrigin = requestUrl.searchParams.get("origin");
        if (!frontendOrigin && request.headers.get("Referer")) {
            try {
                frontendOrigin = new URL(request.headers.get("Referer")).origin;
            } catch {
                frontendOrigin = DEFAULT_FRONTEND_URL;
            }
        }
        if (!frontendOrigin) {
            frontendOrigin = DEFAULT_FRONTEND_URL;
        }

        const redirectUri = getBackendCallbackUrl(request, env);
        const nonce = crypto.randomUUID();
        const statePayload = `${nonce}|${userId}|${frontendOrigin}|${encodeURIComponent(redirectUri)}`;

        const appId = env.INSTAGRAM_APP_ID || env.FACEBOOK_APP_ID;
        if (!appId) {
            return withCors(new Response(
                JSON.stringify({
                    success: false,
                    error: "INSTAGRAM_APP_ID or FACEBOOK_APP_ID is not configured in backend environment (.dev.vars).",
                }),
                { status: 500, headers: { "Content-Type": "application/json" } }
            ), request);
        }

        const authUrl = new URL(META_OAUTH_URL);
        authUrl.searchParams.set("client_id", appId);
        authUrl.searchParams.set("redirect_uri", redirectUri);
        authUrl.searchParams.set("response_type", "code");
        authUrl.searchParams.set("state", statePayload);
        authUrl.searchParams.set("scope", INSTAGRAM_SCOPES.join(","));

        return new Response(null, {
            status: 302,
            headers: {
                Location: authUrl.toString(),
                "Set-Cookie": createStateCookie(statePayload),
            },
        });
    } catch (err) {
        console.error("instagramAuth error:", err);
        return withCors(new Response(
            JSON.stringify({ success: false, error: err.message || "Failed to initiate Instagram OAuth" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        ), request);
    }
}

/**
 * GET /api/instagram/callback
 * Handles OAuth callback from Meta, discovers linked Instagram Business accounts, and saves to D1
 */
export async function instagramCallback(request, env) {
    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get("code");
    const state = requestUrl.searchParams.get("state");
    const error = requestUrl.searchParams.get("error");
    const errorDescription = requestUrl.searchParams.get("error_description");

    let targetOrigin = DEFAULT_FRONTEND_URL;
    let userId = null;
    let storedRedirectUri = null;

    if (state) {
        const parts = state.split("|");
        if (parts.length >= 4) {
            userId = parts[1];
            targetOrigin = parts[2];
            storedRedirectUri = decodeURIComponent(parts[3]);
        } else if (parts.length >= 3) {
            userId = parts[1];
            targetOrigin = parts[2];
        } else if (parts.length === 2) {
            userId = parts[1];
        }
    }

    const frontendCallbackUrl = `${targetOrigin}/instagram/callback`;

    if (error) {
        const errMsg = errorDescription || "Instagram authorization was denied.";
        return new Response(null, {
            status: 302,
            headers: {
                Location: `${frontendCallbackUrl}?error=${encodeURIComponent(errMsg)}`,
                "Set-Cookie": "instagram_oauth_state=; Path=/; Max-Age=0",
            },
        });
    }

    if (!code) {
        return new Response(null, {
            status: 302,
            headers: {
                Location: `${frontendCallbackUrl}?error=${encodeURIComponent("Authorization code is missing.")}`,
                "Set-Cookie": "instagram_oauth_state=; Path=/; Max-Age=0",
            },
        });
    }

    if (!userId) {
        userId = await resolveUserId(request, env);
    }

    if (!userId) {
        return new Response(null, {
            status: 302,
            headers: {
                Location: `${frontendCallbackUrl}?error=${encodeURIComponent("Could not identify authenticated user.")}`,
                "Set-Cookie": "instagram_oauth_state=; Path=/; Max-Age=0",
            },
        });
    }

    try {
        const redirectUri = storedRedirectUri || getBackendCallbackUrl(request, env);
        const tokenData = await exchangeInstagramCodeForUserToken(code, redirectUri, env);
        const userAccessToken = tokenData.access_token;

        // Discover ALL linked Instagram Business/Creator accounts
        const accounts = await getInstagramBusinessAccounts(userAccessToken);

        if (!accounts || accounts.length === 0) {
            return new Response(null, {
                status: 302,
                headers: {
                    Location: `${frontendCallbackUrl}?error=${encodeURIComponent("No linked Instagram Business or Creator accounts found. Please switch to a Professional account and link it to a Facebook Page.")}`,
                    "Set-Cookie": "instagram_oauth_state=; Path=/; Max-Age=0",
                },
            });
        }

        // Store the full accounts list (with tokens) in D1 pending_oauth_sessions.
        // Frontend will show a picker so user selects which account to connect.
        const pendingKey = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

        const accountsPayload = accounts.map((a) => ({
            id: a.instagram_business_id,
            username: a.username,
            name: a.name,
            profile_picture_url: a.profile_picture_url,
            page_id: a.page_id,
            page_name: a.page_name,
            access_token: a.access_token,
        }));

        await env.socialhub_db
            .prepare(`
                INSERT INTO pending_oauth_sessions (id, user_id, platform, payload, expires_at)
                VALUES (?, ?, 'instagram', ?, ?)
                ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, expires_at = excluded.expires_at
            `)
            .bind(pendingKey, userId, JSON.stringify(accountsPayload), expiresAt)
            .run();

        // Send token-free list to frontend for user to pick from
        const safeAccounts = accountsPayload.map((a) => ({
            id: a.id,
            username: a.username,
            name: a.name,
            profile_picture_url: a.profile_picture_url,
            page_name: a.page_name,
        }));

        const params = new URLSearchParams({
            pending: pendingKey,
            platform: "instagram",
            accounts: JSON.stringify(safeAccounts),
        });

        return new Response(null, {
            status: 302,
            headers: {
                Location: `${frontendCallbackUrl}?${params.toString()}`,
                "Set-Cookie": "instagram_oauth_state=; Path=/; Max-Age=0",
            },
        });
    } catch (err) {
        console.error("Instagram OAuth callback error:", err);
        return new Response(null, {
            status: 302,
            headers: {
                Location: `${frontendCallbackUrl}?error=${encodeURIComponent(err.message || "Failed to exchange token with Instagram.")}`,
                "Set-Cookie": "instagram_oauth_state=; Path=/; Max-Age=0",
            },
        });
    }
}

/**
 * POST /api/instagram/accounts/select
 * Called from frontend after user picks which Instagram account to connect.
 */
export async function selectInstagramAccount(request, env) {
    const userId = await resolveUserId(request, env);
    if (!userId) {
        return withCors(new Response(
            JSON.stringify({ success: false, error: "Unauthorized" }),
            { status: 401, headers: { "Content-Type": "application/json" } }
        ), request);
    }

    let pendingKey, selectedAccountId;
    try {
        const body = await request.json();
        pendingKey = body.pendingKey;
        selectedAccountId = body.accountId;
    } catch {
        return withCors(new Response(
            JSON.stringify({ success: false, error: "Invalid JSON body." }),
            { status: 400, headers: { "Content-Type": "application/json" } }
        ), request);
    }

    if (!pendingKey || !selectedAccountId) {
        return withCors(new Response(
            JSON.stringify({ success: false, error: "pendingKey and accountId are required." }),
            { status: 400, headers: { "Content-Type": "application/json" } }
        ), request);
    }

    // Load pending OAuth session
    const pending = await env.socialhub_db
        .prepare("SELECT payload, expires_at FROM pending_oauth_sessions WHERE id = ? AND platform = 'instagram'")
        .bind(pendingKey)
        .first();

    if (!pending) {
        return withCors(new Response(
            JSON.stringify({ success: false, error: "Session expired or not found. Please reconnect." }),
            { status: 404, headers: { "Content-Type": "application/json" } }
        ), request);
    }

    if (new Date(pending.expires_at) < new Date()) {
        return withCors(new Response(
            JSON.stringify({ success: false, error: "Session has expired. Please reconnect Instagram." }),
            { status: 410, headers: { "Content-Type": "application/json" } }
        ), request);
    }

    const allAccounts = JSON.parse(pending.payload);
    const selectedAccount = allAccounts.find((a) => a.id === selectedAccountId);

    if (!selectedAccount) {
        return withCors(new Response(
            JSON.stringify({ success: false, error: "Selected account not found in session." }),
            { status: 404, headers: { "Content-Type": "application/json" } }
        ), request);
    }

    // Save the chosen Instagram account
    await env.socialhub_db
        .prepare(`
            INSERT INTO instagram_accounts (
                id, user_id, instagram_business_id, username, name, profile_picture_url, page_id, access_token, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id, instagram_business_id) DO UPDATE SET
                username = excluded.username,
                name = excluded.name,
                profile_picture_url = excluded.profile_picture_url,
                page_id = excluded.page_id,
                access_token = excluded.access_token,
                updated_at = CURRENT_TIMESTAMP
        `)
        .bind(
            crypto.randomUUID(), userId,
            selectedAccount.id, selectedAccount.username, selectedAccount.name,
            selectedAccount.profile_picture_url || null,
            selectedAccount.page_id || null,
            selectedAccount.access_token
        )
        .run();

    // If this Instagram account is linked to a Facebook Page, touch that page's updated_at too
    if (selectedAccount.page_id) {
        await env.socialhub_db
            .prepare("UPDATE facebook_pages SET updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND page_id = ?")
            .bind(userId, selectedAccount.page_id)
            .run();
    }

    // Clean up pending session
    await env.socialhub_db
        .prepare("DELETE FROM pending_oauth_sessions WHERE id = ?")
        .bind(pendingKey)
        .run();

    return withCors(new Response(
        JSON.stringify({
            success: true,
            account: {
                id: selectedAccount.id,
                username: selectedAccount.username,
                name: selectedAccount.name,
            },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
    ), request);
}

/**
 * POST /api/instagram/accounts/activate
 * Fast in-app switch of active Instagram account without re-doing OAuth
 */
export async function activateInstagramAccount(request, env) {
    const userId = await resolveUserId(request, env);
    if (!userId) {
        return withCors(new Response(
            JSON.stringify({ success: false, error: "Unauthorized" }),
            { status: 401, headers: { "Content-Type": "application/json" } }
        ), request);
    }

    try {
        const body = await request.json();
        const accountId = body.accountId;
        if (!accountId) {
            return withCors(new Response(
                JSON.stringify({ success: false, error: "accountId is required" }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            ), request);
        }

        // Set updated_at to now for this Instagram account so it sorts first
        await env.socialhub_db
            .prepare("UPDATE instagram_accounts SET updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND instagram_business_id = ?")
            .bind(userId, accountId)
            .run();

        const account = await env.socialhub_db
            .prepare("SELECT instagram_business_id AS id, username, name, profile_picture_url, page_id FROM instagram_accounts WHERE user_id = ? AND instagram_business_id = ?")
            .bind(userId, accountId)
            .first();

        // Also if page_id exists, touch the corresponding Facebook page
        if (account && account.page_id) {
            await env.socialhub_db
                .prepare("UPDATE facebook_pages SET updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND page_id = ?")
                .bind(userId, account.page_id)
                .run();
        }

        return withCors(new Response(
            JSON.stringify({ success: true, account }),
            { status: 200, headers: { "Content-Type": "application/json" } }
        ), request);
    } catch (err) {
        return withCors(new Response(
            JSON.stringify({ success: false, error: err.message }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        ), request);
    }
}

/**
 * GET /api/instagram/accounts
 * Returns connected Instagram accounts for user, latest active first.
 */
export async function getInstagramAccountsForUser(request, env) {
    const userId = await resolveUserId(request, env);

    if (!userId) {
        return withCors(new Response(
            JSON.stringify({ success: false, error: "Unauthorized" }),
            { status: 401, headers: { "Content-Type": "application/json" } }
        ), request);
    }

    const { results } = await env.socialhub_db
        .prepare(`
            SELECT instagram_business_id AS id, username, name, profile_picture_url, page_id, updated_at, created_at
            FROM instagram_accounts
            WHERE user_id = ?
            ORDER BY updated_at DESC, created_at DESC
        `)
        .bind(userId)
        .all();

    return withCors(new Response(
        JSON.stringify({ success: true, accounts: results || [] }),
        { status: 200, headers: { "Content-Type": "application/json" } }
    ), request);
}

/**
 * POST /api/instagram/sync-token (or /api/instagram/connect-direct)
 * Connects Instagram directly using an access token (provided in request or from .dev.vars)
 */
export async function syncInstagramDirectToken(request, env) {
    const userId = await resolveUserId(request, env);

    if (!userId) {
        return withCors(new Response(
            JSON.stringify({ success: false, error: "Unauthorized. Please log in first." }),
            { status: 401, headers: { "Content-Type": "application/json" } }
        ), request);
    }

    let token = null;
    let businessAccountId = null;

    try {
        const body = await request.json().catch(() => ({}));
        token = body.accessToken || body.token || env.INSTAGRAM_ACCESS_TOKEN;
        businessAccountId = body.businessAccountId || body.instagramBusinessId || env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
    } catch {
        token = env.INSTAGRAM_ACCESS_TOKEN;
        businessAccountId = env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
    }

    if (!token) {
        return withCors(new Response(
            JSON.stringify({
                success: false,
                error: "Access token is required. Pass accessToken in request body or set INSTAGRAM_ACCESS_TOKEN in .dev.vars.",
            }),
            { status: 400, headers: { "Content-Type": "application/json" } }
        ), request);
    }

    try {
        let accounts = [];

        // 1. Try discovering via /me/accounts
        try {
            accounts = await getInstagramBusinessAccounts(token);
        } catch (e) {
            console.warn("Direct /me/accounts lookup failed, trying direct ID if available:", e.message);
        }

        // 2. If businessAccountId is provided and not found in accounts, fetch directly
        if (businessAccountId && accounts.length === 0) {
            try {
                const details = await getInstagramAccountDetails(businessAccountId, token);
                accounts.push({
                    instagram_business_id: details.id,
                    username: details.username || "instagram_user",
                    name: details.name || "Instagram Account",
                    profile_picture_url: details.profile_picture_url || null,
                    page_id: null,
                    access_token: token,
                });
            } catch (err) {
                console.error("Direct account details lookup failed:", err);
            }
        }

        if (accounts.length === 0) {
            return withCors(new Response(
                JSON.stringify({
                    success: false,
                    error: "No Instagram Business account could be discovered with this access token. Make sure the token has permissions: instagram_basic, instagram_content_publish, pages_show_list.",
                }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            ), request);
        }

        // Save into DB
        for (const acc of accounts) {
            await env.socialhub_db
                .prepare(`
                    INSERT INTO instagram_accounts (
                        id, user_id, instagram_business_id, username, name, profile_picture_url, page_id, access_token, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                    ON CONFLICT(user_id, instagram_business_id) DO UPDATE SET
                        username = excluded.username,
                        name = excluded.name,
                        profile_picture_url = excluded.profile_picture_url,
                        access_token = excluded.access_token,
                        updated_at = CURRENT_TIMESTAMP
                `)
                .bind(
                    crypto.randomUUID(),
                    userId,
                    acc.instagram_business_id,
                    acc.username,
                    acc.name,
                    acc.profile_picture_url,
                    acc.page_id,
                    acc.access_token
                )
                .run();
        }

        return withCors(new Response(
            JSON.stringify({
                success: true,
                message: `Successfully connected ${accounts.length} Instagram account(s)!`,
                accounts: accounts.map((a) => ({
                    id: a.instagram_business_id,
                    username: a.username,
                    name: a.name,
                })),
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
        ), request);
    } catch (err) {
        console.error("syncInstagramDirectToken error:", err);
        return withCors(new Response(
            JSON.stringify({ success: false, error: err.message || "Failed to sync Instagram account with token." }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        ), request);
    }
}

function base64ToBlob(base64String, defaultType = "image/jpeg") {
    let contentType = defaultType;
    let rawBase64 = base64String;

    if (base64String.includes(",")) {
        const parts = base64String.split(",");
        const mimeMatch = parts[0].match(/:(.*?);/);
        if (mimeMatch) {
            contentType = mimeMatch[1];
        }
        rawBase64 = parts[1];
    }

    const binaryString = atob(rawBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return new Blob([bytes], { type: contentType });
}

/**
 * POST /api/instagram/post (and POST /api/auth/instagram/post)
 * Publishes a media post to Instagram Business account
 */
export async function handleInstagramPost(request, env) {
    let accountId = null;
    let caption = "";
    let imageFile = null;
    let imageUrl = null;

    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
        try {
            const formData = await request.formData();
            accountId = formData.get("accountId") || formData.get("instagramAccountId") || formData.get("pageId");
            caption = formData.get("caption") || formData.get("message") || "";
            imageFile = formData.get("image") || formData.get("file");
            imageUrl = formData.get("imageUrl");
        } catch (e) {
            return withCors(new Response(
                JSON.stringify({ success: false, error: "Failed to parse form data: " + e.message }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            ), request);
        }
    } else {
        try {
            const body = await request.json();
            accountId = body.accountId || body.instagramAccountId || body.pageId;
            caption = body.caption || body.message || "";
            imageUrl = body.imageUrl;
            if (body.imageBase64) {
                imageFile = base64ToBlob(body.imageBase64);
            }
        } catch {
            return withCors(new Response(
                JSON.stringify({ success: false, error: "Invalid JSON or form data body." }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            ), request);
        }
    }

    // Instagram strictly requires an image/media URL
    if (!imageFile && !imageUrl) {
        return withCors(new Response(
            JSON.stringify({
                success: false,
                error: "Instagram requires an image. Text-only posts are not supported by the Instagram Graph API.",
            }),
            { status: 400, headers: { "Content-Type": "application/json" } }
        ), request);
    }

    // Lookup Instagram Account in DB
    let account = null;
    if (accountId) {
        account = await env.socialhub_db
            .prepare(`
                SELECT user_id, instagram_business_id, username, name, access_token
                FROM instagram_accounts
                WHERE instagram_business_id = ?
                ORDER BY updated_at DESC LIMIT 1
            `)
            .bind(accountId)
            .first();
    }

    // Fallback if not found by specific accountId
    if (!account) {
        account = await env.socialhub_db
            .prepare(`
                SELECT user_id, instagram_business_id, username, name, access_token
                FROM instagram_accounts
                ORDER BY updated_at DESC LIMIT 1
            `)
            .first();
    }

    // Direct token fallback from .dev.vars if configured
    let businessId = account?.instagram_business_id || env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
    let accessToken = account?.access_token || env.INSTAGRAM_ACCESS_TOKEN;
    let accountName = account?.name || account?.username || "Instagram";

    if (!businessId || !accessToken) {
        return withCors(new Response(
            JSON.stringify({
                success: false,
                error: "Instagram account is not connected. Please connect Instagram or provide INSTAGRAM_ACCESS_TOKEN and INSTAGRAM_BUSINESS_ACCOUNT_ID in .dev.vars.",
            }),
            { status: 404, headers: { "Content-Type": "application/json" } }
        ), request);
    }

    const userId = (await resolveUserId(request, env)) || account?.user_id;

    try {
        let r2Key = null;
        let finalImageUrl = imageUrl;

        // 1. SAVE IMAGE TO R2 STORAGE (socialhub-media)
        if (imageFile) {
            try {
                const arrayBuffer = await imageFile.arrayBuffer();

                if (env.socialhub_media) {
                    const originalName = imageFile.name ? imageFile.name.replace(/[^a-zA-Z0-9._-]/g, '_') : 'image.jpg';
                    const fileId = crypto.randomUUID();
                    r2Key = `posts/${userId}/${fileId}-${originalName}`;

                    await env.socialhub_media.put(r2Key, arrayBuffer, {
                        httpMetadata: {
                            contentType: imageFile.type || 'image/jpeg',
                        },
                        customMetadata: {
                            userId: userId || 'anonymous',
                            channel: 'instagram',
                            instagramBusinessId: businessId,
                            originalName: originalName,
                            uploadedAt: new Date().toISOString(),
                        },
                    });

                    // Determine public media URL for Instagram to download
                    const reqUrl = new URL(request.url);
                    if (env.PUBLIC_BASE_URL) {
                        finalImageUrl = `${env.PUBLIC_BASE_URL.replace(/\/$/, '')}/api/media/${encodeURIComponent(r2Key)}`;
                    } else if (!reqUrl.hostname.includes("localhost") && !reqUrl.hostname.includes("127.0.0.1")) {
                        finalImageUrl = `${reqUrl.protocol}//${reqUrl.host}/api/media/${encodeURIComponent(r2Key)}`;
                    }
                }
            } catch (r2Err) {
                console.error("Warning: Error writing image to Cloudflare R2 bucket:", r2Err);
            }
        }

        // Validate public URL requirement for Instagram
        if (!finalImageUrl) {
            return withCors(new Response(
                JSON.stringify({
                    success: false,
                    error: "Instagram requires a publicly accessible image URL. When running locally on localhost, please either provide a public imageUrl, or configure PUBLIC_BASE_URL (e.g., Cloudflare tunnel or ngrok) in .dev.vars.",
                }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            ), request);
        }

        // 2. PUBLISH TO INSTAGRAM
        const publishResult = await publishInstagramPhotoPost({
            instagramBusinessId: businessId,
            accessToken,
            imageUrl: finalImageUrl,
            caption: caption ? caption.toString().trim() : "",
        });

        const igPostId = publishResult.id;
        const recordId = crypto.randomUUID();

        // 3. SAVE POST HISTORY TO D1 DATABASE
        try {
            await env.socialhub_db.prepare(`
                INSERT INTO posts (id, user_id, channel, page_id, page_name, post_id, message, media_key, media_url, media_type, status, created_at)
                VALUES (?, ?, 'instagram', ?, ?, ?, ?, ?, ?, 'photo', 'published', CURRENT_TIMESTAMP)
            `).bind(
                recordId,
                userId || 'anonymous',
                businessId,
                accountName,
                igPostId,
                caption || null,
                r2Key || null,
                finalImageUrl,
            ).run();
        } catch (dbErr) {
            console.error("Warning: Failed to record Instagram post in D1 database:", dbErr);
        }

        return withCors(new Response(
            JSON.stringify({
                success: true,
                type: "photo",
                channel: "instagram",
                message: `Post published successfully to Instagram (@${account?.username || accountName})!`,
                postId: igPostId,
                containerId: publishResult.containerId,
                mediaKey: r2Key,
                mediaUrl: finalImageUrl,
                savedToR2: Boolean(r2Key),
                savedToDatabase: true,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
        ), request);
    } catch (err) {
        console.error("Instagram post publishing error:", err);
        return withCors(new Response(
            JSON.stringify({
                success: false,
                error: err.message || "Failed to publish post to Instagram.",
            }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        ), request);
    }
}
