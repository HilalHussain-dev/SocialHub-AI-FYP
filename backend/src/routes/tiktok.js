import {
    buildTikTokAuthUrl,
    exchangeTikTokCodeForToken,
    refreshTikTokToken,
    revokeTikTokToken,
    getTikTokUserProfile,
    getTikTokCreatorInfo,
    initVideoPublish,
    uploadVideoChunk,
    checkPublishStatus,
    fetchPublishStatus,
    mapTikTokStatus,
    TIKTOK_SCOPES,
    getTikTokScopes,
    base64UrlEncode,
    base64UrlDecode,
} from "../services/tiktok.js";
import { getSessionCookie } from "../utils/auth.js";
import { withCors } from "../utils/cors.js";

const DEFAULT_FRONTEND_URL = "http://localhost:8443";

/**
 * Ensure tiktok_accounts table exists in D1
 */
export async function ensureTikTokTable(db) {
    if (!db) return;
    try {
        await db.prepare(`
            CREATE TABLE IF NOT EXISTS tiktok_accounts (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                open_id TEXT NOT NULL,
                union_id TEXT,
                username TEXT,
                display_name TEXT,
                avatar_url TEXT,
                access_token TEXT NOT NULL,
                refresh_token TEXT,
                token_expires_at TIMESTAMP,
                refresh_token_expires_at TIMESTAMP,
                scope TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, open_id),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `).run();
    } catch (e) {
        console.warn("ensureTikTokTable note:", e.message);
    }
}

function getBackendCallbackUrl(request, env) {
    const url = new URL(request.url);
    const queryRedirect = url.searchParams.get("redirect_uri") || url.searchParams.get("callback_url");
    if (queryRedirect) {
        return queryRedirect;
    }
    if (env.TIKTOK_REDIRECT_URI) {
        return env.TIKTOK_REDIRECT_URI;
    }

    const clientOrigin = request.headers.get("origin") || request.headers.get("referer") || url.searchParams.get("origin") || "";
    if (clientOrigin.includes("localhost") || clientOrigin.includes("127.0.0.1") || url.hostname === "localhost") {
        return "http://localhost:8787/api/tiktok/callback";
    }

    return "http://localhost:8787/api/tiktok/callback";
}

function createStateCookie(name, val, maxAge = 600) {
    return [
        `${name}=${encodeURIComponent(val)}`,
        "HttpOnly",
        "Path=/",
        "SameSite=Lax",
        `Max-Age=${maxAge}`,
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
 * GET /api/tiktok/auth (and GET /api/auth/tiktok/connect)
 * Initiates TikTok OAuth 2.0 flow
 */
export async function tiktokAuth(request, env) {
    await ensureTikTokTable(env.socialhub_db);
    const requestUrl = new URL(request.url);
    const userId = await resolveUserId(request, env);

    if (!userId) {
        return withCors(new Response(
            JSON.stringify({ success: false, error: "Please log in first before connecting TikTok." }),
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

        const clientKey = env?.TIKTOK_CLIENT_KEY;
        if (!clientKey) {
            return withCors(new Response(
                JSON.stringify({
                    success: false,
                    error: "TIKTOK_CLIENT_KEY is not configured in backend environment secrets (.dev.vars). Please provide your TikTok App credentials.",
                }),
                { status: 500, headers: { "Content-Type": "application/json" } }
            ), request);
        }

        const redirectUri = getBackendCallbackUrl(request, env);
        const nonce = crypto.randomUUID();

        const queryScope = requestUrl.searchParams.get("scope");
        const scopes = queryScope
            ? queryScope.split(",").map((s) => s.trim()).filter(Boolean)
            : getTikTokScopes(env);

        // Build Auth URL (for Web Login Kit, PKCE is disabled by default to avoid bytedance:// bridge errors)
        const authData = await buildTikTokAuthUrl({
            clientKey,
            redirectUri,
            state: "", // will fill below
            scopes,
            env,
            enablePkce: env?.TIKTOK_ENABLE_PKCE === "true",
        });

        // Build state payload: use compact URL-safe Base64 JSON so TikTok's query parser has no issues with pipes or colons
        const stateObj = {
            nonce,
            userId,
            origin: frontendOrigin,
            redirectUri,
            verifier: authData.codeVerifier || "",
        };
        const statePayload = base64UrlEncode(new TextEncoder().encode(JSON.stringify(stateObj)));
        const finalUrl = new URL(authData.url);
        finalUrl.searchParams.set("state", statePayload);

        const headers = new Headers();
        headers.set("Location", finalUrl.toString());
        headers.append("Set-Cookie", createStateCookie("tiktok_oauth_state", statePayload));
        if (authData.codeVerifier) {
            headers.append("Set-Cookie", createStateCookie("tiktok_code_verifier", authData.codeVerifier));
        }

        return new Response(null, {
            status: 302,
            headers,
        });
    } catch (err) {
        console.error("tiktokAuth error:", err);
        return withCors(new Response(
            JSON.stringify({ success: false, error: err.message || "Failed to initiate TikTok OAuth" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        ), request);
    }
}

/**
 * GET /api/tiktok/callback
 * Handles OAuth callback from TikTok Login Kit, exchanges code for token, stores account in D1, redirects.
 */
export async function tiktokCallback(request, env) {
    await ensureTikTokTable(env.socialhub_db);
    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get("code");
    const state = requestUrl.searchParams.get("state");
    const error = requestUrl.searchParams.get("error");
    const errorDescription = requestUrl.searchParams.get("error_description");

    let targetOrigin = DEFAULT_FRONTEND_URL;
    let userId = null;
    let storedRedirectUri = null;
    let codeVerifier = getCookie(request, "tiktok_code_verifier");

    if (state) {
        try {
            // First try Base64URL JSON decoding
            const bytes = base64UrlDecode(state);
            const jsonText = new TextDecoder().decode(bytes);
            const stateObj = JSON.parse(jsonText);
            if (stateObj.userId) userId = stateObj.userId;
            if (stateObj.origin) targetOrigin = stateObj.origin;
            if (stateObj.redirectUri) storedRedirectUri = stateObj.redirectUri;
            if (!codeVerifier && stateObj.verifier) codeVerifier = stateObj.verifier;
        } catch {
            // Fallback for pipe-separated state
            const parts = state.split("|");
            if (parts.length >= 5) {
                userId = parts[1];
                targetOrigin = parts[2];
                storedRedirectUri = decodeURIComponent(parts[3]);
                if (!codeVerifier) codeVerifier = parts[4];
            } else if (parts.length >= 4) {
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
    }

    const frontendCallbackUrl = `${targetOrigin}/tiktok/callback`;

    if (error) {
        const errMsg = errorDescription || error || "TikTok authorization was denied.";
        return new Response(null, {
            status: 302,
            headers: {
                Location: `${frontendCallbackUrl}?error=${encodeURIComponent(errMsg)}`,
                "Set-Cookie": "tiktok_oauth_state=; Path=/; Max-Age=0",
            },
        });
    }

    if (!code) {
        return new Response(null, {
            status: 302,
            headers: {
                Location: `${frontendCallbackUrl}?error=${encodeURIComponent("Authorization code is missing from TikTok callback.")}`,
                "Set-Cookie": "tiktok_oauth_state=; Path=/; Max-Age=0",
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
                "Set-Cookie": "tiktok_oauth_state=; Path=/; Max-Age=0",
            },
        });
    }

    try {
        const redirectUri = storedRedirectUri || getBackendCallbackUrl(request, env);
        const tokenData = await exchangeTikTokCodeForToken(code, redirectUri, env, codeVerifier);

        const accessToken = tokenData.access_token;
        const refreshToken = tokenData.refresh_token || null;
        const expiresIn = tokenData.expires_in || 86400; // default 24 hours
        const refreshExpiresIn = tokenData.refresh_expires_in || 31536000; // default 365 days
        const scope = tokenData.scope || TIKTOK_SCOPES.join(",");
        const openIdFromToken = tokenData.open_id || "";

        const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
        const refreshExpiresAt = new Date(Date.now() + refreshExpiresIn * 1000).toISOString();

        // Retrieve user profile from TikTok user.info.basic (with fallback)
        let profile = {};
        try {
            profile = await getTikTokUserProfile(accessToken, env);
        } catch (pfErr) {
            console.warn("Failed to fetch full TikTok profile, using token metadata:", pfErr.message);
        }
        const openId = profile.open_id || openIdFromToken || crypto.randomUUID();
        const unionId = profile.union_id || null;
        const username = profile.username || profile.display_name || "tiktok_creator";
        const displayName = profile.display_name || profile.username || "TikTok User";
        const avatarUrl = profile.avatar_url || null;

        // Save connected TikTok account to D1 database
        const recordId = crypto.randomUUID();
        await env.socialhub_db
            .prepare(`
                INSERT INTO tiktok_accounts (
                    id, user_id, open_id, union_id, username, display_name, avatar_url,
                    access_token, refresh_token, token_expires_at, refresh_token_expires_at,
                    scope, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(user_id, open_id) DO UPDATE SET
                    union_id = excluded.union_id,
                    username = excluded.username,
                    display_name = excluded.display_name,
                    avatar_url = excluded.avatar_url,
                    access_token = excluded.access_token,
                    refresh_token = excluded.refresh_token,
                    token_expires_at = excluded.token_expires_at,
                    refresh_token_expires_at = excluded.refresh_token_expires_at,
                    scope = excluded.scope,
                    updated_at = CURRENT_TIMESTAMP
            `)
            .bind(
                recordId,
                userId,
                openId,
                unionId,
                username,
                displayName,
                avatarUrl,
                accessToken,
                refreshToken,
                tokenExpiresAt,
                refreshExpiresAt,
                scope
            )
            .run();

        const params = new URLSearchParams({
            platform: "tiktok",
            success: "true",
            username: username,
            name: displayName,
            accountId: openId,
            avatarUrl: avatarUrl || "",
        });

        const headers = new Headers();
        headers.set("Location", `${frontendCallbackUrl}?${params.toString()}`);
        headers.append("Set-Cookie", "tiktok_oauth_state=; Path=/; Max-Age=0");
        headers.append("Set-Cookie", "tiktok_code_verifier=; Path=/; Max-Age=0");

        return new Response(null, {
            status: 302,
            headers,
        });
    } catch (err) {
        console.error("TikTok OAuth callback error:", err);
        return new Response(null, {
            status: 302,
            headers: {
                Location: `${frontendCallbackUrl}?error=${encodeURIComponent(err.message || "Failed to exchange token with TikTok.")}`,
                "Set-Cookie": "tiktok_oauth_state=; Path=/; Max-Age=0",
            },
        });
    }
}

/**
 * GET /api/tiktok/accounts
 * Returns all connected TikTok accounts for the logged-in user
 */
export async function getTikTokAccountsForUser(request, env) {
    await ensureTikTokTable(env.socialhub_db);
    const userId = await resolveUserId(request, env);
    if (!userId) {
        return withCors(new Response(
            JSON.stringify({ success: false, error: "Unauthorized" }),
            { status: 401, headers: { "Content-Type": "application/json" } }
        ), request);
    }

    try {
        const { results } = await env.socialhub_db
            .prepare(`
                SELECT id, open_id, union_id, username, display_name, avatar_url, scope,
                       token_expires_at, refresh_token_expires_at, updated_at, created_at
                FROM tiktok_accounts
                WHERE user_id = ?
                ORDER BY updated_at DESC, created_at DESC
            `)
            .bind(userId)
            .all();

        const accounts = results || [];

        return withCors(new Response(
            JSON.stringify({ success: true, accounts }),
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
 * POST /api/tiktok/accounts/activate
 * Fast in-app switch of active TikTok account
 */
export async function activateTikTokAccount(request, env) {
    await ensureTikTokTable(env.socialhub_db);
    const userId = await resolveUserId(request, env);
    if (!userId) {
        return withCors(new Response(
            JSON.stringify({ success: false, error: "Unauthorized" }),
            { status: 401, headers: { "Content-Type": "application/json" } }
        ), request);
    }

    try {
        const body = await request.json().catch(() => ({}));
        const accountId = body.accountId || body.open_id;

        if (!accountId) {
            return withCors(new Response(
                JSON.stringify({ success: false, error: "accountId (or open_id) is required" }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            ), request);
        }

        await env.socialhub_db
            .prepare("UPDATE tiktok_accounts SET updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND (open_id = ? OR id = ?)")
            .bind(userId, accountId, accountId)
            .run();

        const account = await env.socialhub_db
            .prepare("SELECT id, open_id, username, display_name, avatar_url FROM tiktok_accounts WHERE user_id = ? AND (open_id = ? OR id = ?)")
            .bind(userId, accountId, accountId)
            .first();

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
 * POST /api/tiktok/disconnect (and DELETE /api/tiktok/accounts)
 * Securely disconnects TikTok account: revokes access token and removes from D1
 */
export async function disconnectTikTokAccount(request, env) {
    await ensureTikTokTable(env.socialhub_db);
    const userId = await resolveUserId(request, env);
    if (!userId) {
        return withCors(new Response(
            JSON.stringify({ success: false, error: "Unauthorized" }),
            { status: 401, headers: { "Content-Type": "application/json" } }
        ), request);
    }

    try {
        let accountId = null;
        if (request.method === "POST") {
            const body = await request.json().catch(() => ({}));
            accountId = body.accountId || body.open_id || body.id;
        } else {
            const url = new URL(request.url);
            accountId = url.searchParams.get("accountId") || url.searchParams.get("open_id") || url.searchParams.get("id");
        }

        let account = null;
        if (accountId) {
            account = await env.socialhub_db
                .prepare("SELECT * FROM tiktok_accounts WHERE user_id = ? AND (open_id = ? OR id = ?) LIMIT 1")
                .bind(userId, accountId, accountId)
                .first();
        } else {
            account = await env.socialhub_db
                .prepare("SELECT * FROM tiktok_accounts WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1")
                .bind(userId)
                .first();
        }

        if (!account) {
            return withCors(new Response(
                JSON.stringify({ success: false, error: "TikTok account not found." }),
                { status: 404, headers: { "Content-Type": "application/json" } }
            ), request);
        }

        // Revoke token on TikTok side if active
        if (account.access_token) {
            await revokeTikTokToken(account.access_token, env).catch((e) => {
                console.warn("Revoke warning:", e.message);
            });
        }

        // Delete from D1 database
        await env.socialhub_db
            .prepare("DELETE FROM tiktok_accounts WHERE id = ?")
            .bind(account.id)
            .run();

        return withCors(new Response(
            JSON.stringify({
                success: true,
                message: `TikTok account @${account.username || account.display_name} successfully disconnected.`,
                disconnectedId: account.id,
                openId: account.open_id,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
        ), request);
    } catch (err) {
        return withCors(new Response(
            JSON.stringify({ success: false, error: err.message || "Failed to disconnect TikTok account" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        ), request);
    }
}

/**
 * POST /api/tiktok/token/refresh
 * Manually or automatically refresh access token for an account
 */
export async function refreshTikTokTokenHandler(request, env) {
    await ensureTikTokTable(env.socialhub_db);
    const userId = await resolveUserId(request, env);
    if (!userId) {
        return withCors(new Response(
            JSON.stringify({ success: false, error: "Unauthorized" }),
            { status: 401, headers: { "Content-Type": "application/json" } }
        ), request);
    }

    try {
        const body = await request.json().catch(() => ({}));
        const accountId = body.accountId || body.open_id;

        let account = null;
        if (accountId) {
            account = await env.socialhub_db
                .prepare("SELECT * FROM tiktok_accounts WHERE user_id = ? AND (open_id = ? OR id = ?) LIMIT 1")
                .bind(userId, accountId, accountId)
                .first();
        } else {
            account = await env.socialhub_db
                .prepare("SELECT * FROM tiktok_accounts WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1")
                .bind(userId)
                .first();
        }

        if (!account || !account.refresh_token) {
            return withCors(new Response(
                JSON.stringify({ success: false, error: "No refresh token available for this account." }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            ), request);
        }

        const refreshed = await refreshTikTokToken(account.refresh_token, env);
        const newAccessToken = refreshed.access_token;
        const newRefreshToken = refreshed.refresh_token || account.refresh_token;
        const expiresIn = refreshed.expires_in || 86400;
        const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

        await env.socialhub_db
            .prepare(`
                UPDATE tiktok_accounts SET
                    access_token = ?,
                    refresh_token = ?,
                    token_expires_at = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `)
            .bind(newAccessToken, newRefreshToken, expiresAt, account.id)
            .run();

        return withCors(new Response(
            JSON.stringify({
                success: true,
                expiresAt,
                message: "TikTok access token refreshed successfully.",
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
        ), request);
    } catch (err) {
        return withCors(new Response(
            JSON.stringify({ success: false, error: err.message || "Failed to refresh token" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        ), request);
    }
}

/**
 * POST /api/tiktok/post (and POST /api/auth/tiktok/post)
 * Publishes a video to TikTok via Content Posting API.
 * Supports:
 * - Video file upload via multipart/form-data (stored in R2 bucket and uploaded to TikTok)
 * - Video URL via JSON or form-data
 * - Direct Post and Draft Upload modes
 * - Privacy settings, duet/stitch/comment permissions
 */
export async function handleTikTokPost(request, env, ctx = null) {
    await ensureTikTokTable(env.socialhub_db);
    let title = "";
    let privacyLevel = "PUBLIC_TO_EVERYONE";
    let isDraft = false;
    let disableComment = false;
    let disableDuet = false;
    let disableStitch = false;
    let accountId = null;
    let videoFile = null;
    let videoUrl = null;

    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
        try {
            const formData = await request.formData();
            title = formData.get("title") || formData.get("caption") || formData.get("message") || "";
            privacyLevel = formData.get("privacyLevel") || formData.get("privacy_level") || "PUBLIC_TO_EVERYONE";
            isDraft = formData.get("isDraft") === "true" || formData.get("draft") === "true";
            disableComment = formData.get("disableComment") === "true" || formData.get("disable_comment") === "true";
            disableDuet = formData.get("disableDuet") === "true" || formData.get("disable_duet") === "true";
            disableStitch = formData.get("disableStitch") === "true" || formData.get("disable_stitch") === "true";
            accountId = formData.get("accountId") || formData.get("account_id") || formData.get("open_id");
            videoFile = formData.get("video") || formData.get("file") || formData.get("media");
            videoUrl = formData.get("videoUrl") || formData.get("video_url");
        } catch (e) {
            return withCors(new Response(
                JSON.stringify({ success: false, error: "Failed to parse form data: " + e.message }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            ), request);
        }
    } else {
        try {
            const body = await request.json();
            title = body.title || body.caption || body.message || "";
            privacyLevel = body.privacyLevel || body.privacy_level || "PUBLIC_TO_EVERYONE";
            isDraft = !!body.isDraft || !!body.draft;
            disableComment = !!body.disableComment || !!body.disable_comment;
            disableDuet = !!body.disableDuet || !!body.disable_duet;
            disableStitch = !!body.disableStitch || !!body.disable_stitch;
            accountId = body.accountId || body.account_id || body.open_id;
            videoUrl = body.videoUrl || body.video_url;
        } catch {
            return withCors(new Response(
                JSON.stringify({ success: false, error: "Invalid JSON body." }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            ), request);
        }
    }

    if (!videoFile && !videoUrl) {
        return withCors(new Response(
            JSON.stringify({ success: false, error: "TikTok publishing requires a video file or video URL." }),
            { status: 400, headers: { "Content-Type": "application/json" } }
        ), request);
    }

    // Determine user
    let userId = await resolveUserId(request, env);

    // Retrieve active TikTok account
    let account = null;
    if (accountId) {
        account = await env.socialhub_db
            .prepare("SELECT * FROM tiktok_accounts WHERE (open_id = ? OR id = ?) LIMIT 1")
            .bind(accountId, accountId)
            .first();
    } else if (userId) {
        account = await env.socialhub_db
            .prepare("SELECT * FROM tiktok_accounts WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1")
            .bind(userId)
            .first();
    } else {
        account = await env.socialhub_db
            .prepare("SELECT * FROM tiktok_accounts ORDER BY updated_at DESC LIMIT 1")
            .first();
    }

    if (!account || !account.access_token) {
        return withCors(new Response(
            JSON.stringify({ success: false, error: "Please connect a TikTok account before publishing." }),
            { status: 404, headers: { "Content-Type": "application/json" } }
        ), request);
    }

    if (!userId) {
        userId = account.user_id || "direct_user";
    }

    // Check if access token is expired and refresh if necessary
    let accessToken = account.access_token;
    if (account.token_expires_at && new Date(account.token_expires_at) <= new Date(Date.now() + 60000)) {
        if (account.refresh_token) {
            try {
                console.log("TikTok token expired or expiring soon, refreshing...");
                const refreshed = await refreshTikTokToken(account.refresh_token, env);
                accessToken = refreshed.access_token;
                const newRefreshToken = refreshed.refresh_token || account.refresh_token;
                const expiresIn = refreshed.expires_in || 86400;
                const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

                await env.socialhub_db
                    .prepare("UPDATE tiktok_accounts SET access_token = ?, refresh_token = ?, token_expires_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
                    .bind(accessToken, newRefreshToken, expiresAt, account.id)
                    .run();
            } catch (refErr) {
                console.warn("Failed to auto-refresh TikTok token:", refErr.message);
            }
        }
    }

    try {
        let r2Key = null;
        let finalMediaUrl = videoUrl;
        let videoBuffer = null;
        let videoSize = 0;
        let mimeType = "video/mp4";

        // If video file is provided, save to R2 and read buffer
        if (videoFile && typeof videoFile.arrayBuffer === "function") {
            videoBuffer = await videoFile.arrayBuffer();
            videoSize = videoBuffer.byteLength;
            mimeType = videoFile.type || "video/mp4";

            // Save to Cloudflare R2 bucket (socialhub_media)
            if (env.socialhub_media) {
                try {
                    const originalName = videoFile.name ? videoFile.name.replace(/[^a-zA-Z0-9._-]/g, '_') : 'tiktok_video.mp4';
                    const fileId = crypto.randomUUID();
                    r2Key = `posts/${userId}/${fileId}-${originalName}`;

                    await env.socialhub_media.put(r2Key, videoBuffer, {
                        httpMetadata: {
                            contentType: mimeType,
                        },
                        customMetadata: {
                            userId: userId,
                            channel: 'tiktok',
                            originalName: originalName,
                            uploadedAt: new Date().toISOString(),
                        },
                    });

                    const reqUrl = new URL(request.url);
                    finalMediaUrl = `${reqUrl.protocol}//${reqUrl.host}/api/media/${encodeURIComponent(r2Key)}`;
                } catch (r2Err) {
                    console.error("Warning: Error storing TikTok video in R2:", r2Err);
                }
            }
        }

        // Initialize TikTok video publish
        const initPayload = {
            title: title || "Video via SocialHub AI",
            privacyLevel,
            disableComment,
            disableDuet,
            disableStitch,
            isDraft,
            source: videoBuffer ? "FILE_UPLOAD" : "PULL_FROM_URL",
            videoSize: videoBuffer ? videoSize : 0,
            chunkSize: videoBuffer ? videoSize : 0,
            totalChunkCount: 1,
            videoUrl: videoBuffer ? null : finalMediaUrl,
        };

        const initResult = await initVideoPublish(accessToken, initPayload, env);
        const publishId = initResult.publishId;
        const uploadUrl = initResult.uploadUrl;
        const actualIsDraft = initResult.isDraft;

        // If FILE_UPLOAD, upload bytes to TikTok's upload_url
        if (videoBuffer && uploadUrl) {
            await uploadVideoChunk(uploadUrl, videoBuffer, 0, videoSize - 1, videoSize, mimeType);
        }

        // Check initial publish status
        let currentStatus = "PROCESSING_UPLOAD";
        try {
            if (publishId) {
                const statusInfo = await fetchPublishStatus(accessToken, publishId, env);
                if (statusInfo?.status) {
                    currentStatus = statusInfo.status;
                }
            }
        } catch (stErr) {
            console.warn("Initial status fetch note:", stErr?.message || stErr);
        }

        const initialMappedStatus = mapTikTokStatus(currentStatus);

        // Record in posts table in D1
        const recordId = crypto.randomUUID();
        const postAccountName = account.username ? `@${account.username}` : (account.display_name || "TikTok Account");

        await env.socialhub_db
            .prepare(`
                INSERT INTO posts (
                    id, user_id, channel, page_id, page_name, post_id,
                    message, media_key, media_url, media_type, status, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `)
            .bind(
                recordId,
                userId,
                "tiktok",
                account.open_id,
                postAccountName,
                publishId || recordId,
                title,
                r2Key,
                finalMediaUrl,
                "video",
                initialMappedStatus
            )
            .run();

        // Poll fetchPublishStatus every 4s, up to 8 times, and update row when status is final
        if (publishId && initialMappedStatus === "processing_upload") {
            const pollPromise = (async () => {
                try {
                    for (let attempt = 1; attempt <= 8; attempt++) {
                        await new Promise((resolve) => setTimeout(resolve, 4000));
                        const statusResult = await fetchPublishStatus(accessToken, publishId, env);
                        if (!statusResult) continue;

                        const rawStatus = statusResult.status || statusResult.data?.status;
                        const mapped = mapTikTokStatus(rawStatus);

                        if (mapped === "published" || mapped === "failed" || mapped === "draft_sent") {
                            await env.socialhub_db
                                .prepare("UPDATE posts SET status = ? WHERE post_id = ?")
                                .bind(mapped, publishId)
                                .run();
                            break;
                        }
                    }
                } catch (pollErr) {
                    console.warn("TikTok status polling warning:", pollErr?.message || pollErr);
                }
            })();

            if (ctx && typeof ctx.waitUntil === "function") {
                ctx.waitUntil(pollPromise);
            } else {
                pollPromise.catch(() => {});
            }
        }

        const successMessage = actualIsDraft
            ? `Video uploaded to TikTok drafts! Open TikTok on your mobile device to complete and share.`
            : `Video submitted to TikTok! (Publish ID: ${publishId})`;

        return withCors(new Response(
            JSON.stringify({
                success: true,
                postId: publishId || recordId,
                publishId,
                status: currentStatus,
                mappedStatus: initialMappedStatus,
                isDraft: actualIsDraft,
                mediaUrl: finalMediaUrl,
                message: successMessage,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
        ), request);
    } catch (err) {
        console.error("handleTikTokPost error:", err);
        const errMsg = err?.message || "";
        const errCode = err?.code || "";

        if (
            errCode === "unaudited_client_can_only_post_to_private_accounts" ||
            errMsg.includes("unaudited_client_can_only_post_to_private_accounts")
        ) {
            return withCors(new Response(
                JSON.stringify({
                    success: false,
                    error: "Your TikTok account must be private and the post set to 'Only me' while the app is in testing.",
                    code: "unaudited_client_can_only_post_to_private_accounts"
                }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            ), request);
        }

        return withCors(new Response(
            JSON.stringify({ success: false, error: errMsg || "Failed to publish video to TikTok" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        ), request);
    }
}

/**
 * GET /api/tiktok/status
 * Query the publication status of a TikTok video
 */
export async function handleTikTokStatus(request, env) {
    await ensureTikTokTable(env.socialhub_db);
    const userId = await resolveUserId(request, env);
    if (!userId) {
        return withCors(new Response(
            JSON.stringify({ success: false, error: "Unauthorized" }),
            { status: 401, headers: { "Content-Type": "application/json" } }
        ), request);
    }

    const url = new URL(request.url);
    const publishId = url.searchParams.get("publishId") || url.searchParams.get("publish_id");

    if (!publishId) {
        return withCors(new Response(
            JSON.stringify({ success: false, error: "publishId is required." }),
            { status: 400, headers: { "Content-Type": "application/json" } }
        ), request);
    }

    try {
        const account = await env.socialhub_db
            .prepare("SELECT access_token FROM tiktok_accounts WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1")
            .bind(userId)
            .first();

        if (!account || !account.access_token) {
            return withCors(new Response(
                JSON.stringify({ success: false, error: "No connected TikTok account found." }),
                { status: 404, headers: { "Content-Type": "application/json" } }
            ), request);
        }

        const statusResult = await fetchPublishStatus(account.access_token, publishId, env);

        if (!statusResult) {
            return withCors(new Response(
                JSON.stringify({ success: false, error: "Failed to fetch status from TikTok" }),
                { status: 502, headers: { "Content-Type": "application/json" } }
            ), request);
        }

        const mappedStatus = mapTikTokStatus(statusResult.status);
        await env.socialhub_db
            .prepare("UPDATE posts SET status = ? WHERE post_id = ?")
            .bind(mappedStatus, publishId)
            .run();

        return withCors(new Response(
            JSON.stringify({ success: true, ...statusResult, mappedStatus }),
            { status: 200, headers: { "Content-Type": "application/json" } }
        ), request);
    } catch (err) {
        return withCors(new Response(
            JSON.stringify({ success: false, error: err.message || "Failed to fetch status" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        ), request);
    }
}


/**
 * POST /api/tiktok/refresh-status
 * Refresh status for current user's TikTok posts still in processing_upload
 */
export async function handleTikTokRefreshStatus(request, env) {
    await ensureTikTokTable(env.socialhub_db);
    const userId = await resolveUserId(request, env);
    if (!userId) {
        return withCors(new Response(
            JSON.stringify({ success: false, error: "Unauthorized" }),
            { status: 401, headers: { "Content-Type": "application/json" } }
        ), request);
    }

    try {
        const pendingRes = await env.socialhub_db
            .prepare(`
                SELECT id, post_id, page_id
                FROM posts
                WHERE user_id = ? AND channel = 'tiktok' AND status = 'processing_upload'
            `)
            .bind(userId)
            .all();

        const pendingPosts = pendingRes?.results || [];
        if (pendingPosts.length === 0) {
            return withCors(new Response(
                JSON.stringify({ success: true, checkedCount: 0, updatedCount: 0 }),
                { status: 200, headers: { "Content-Type": "application/json" } }
            ), request);
        }

        const accountsRes = await env.socialhub_db
            .prepare("SELECT open_id, access_token, is_active FROM tiktok_accounts WHERE user_id = ?")
            .bind(userId)
            .all();

        const accounts = accountsRes?.results || [];
        const accountByOpenId = new Map(accounts.map((a) => [a.open_id, a.access_token]));
        const fallbackToken = accounts.find((a) => a.is_active)?.access_token || accounts[0]?.access_token;

        if (!fallbackToken) {
            return withCors(new Response(
                JSON.stringify({ success: true, checkedCount: pendingPosts.length, updatedCount: 0, warning: "No active TikTok account token found" }),
                { status: 200, headers: { "Content-Type": "application/json" } }
            ), request);
        }

        let updatedCount = 0;
        for (const post of pendingPosts) {
            const publishId = post.post_id;
            if (!publishId) continue;

            const token = accountByOpenId.get(post.page_id) || fallbackToken;
            if (!token) continue;

            try {
                const statusResult = await fetchPublishStatus(token, publishId, env);
                if (!statusResult) continue;

                const rawStatus = statusResult.status || statusResult.data?.status;
                const mapped = mapTikTokStatus(rawStatus);
                if (mapped !== "processing_upload") {
                    await env.socialhub_db
                        .prepare("UPDATE posts SET status = ? WHERE id = ?")
                        .bind(mapped, post.id)
                        .run();
                    updatedCount++;
                }
            } catch (postErr) {
                console.warn(`Error refreshing status for post ${post.id}:`, postErr?.message || postErr);
            }
        }

        return withCors(new Response(
            JSON.stringify({ success: true, checkedCount: pendingPosts.length, updatedCount }),
            { status: 200, headers: { "Content-Type": "application/json" } }
        ), request);
    } catch (err) {
        console.error("handleTikTokRefreshStatus error:", err);
        return withCors(new Response(
            JSON.stringify({ success: false, error: err.message || "Failed to refresh TikTok status" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        ), request);
    }
}
