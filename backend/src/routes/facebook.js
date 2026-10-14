import {
    exchangeCodeForUserToken,
    getFacebookPages,
    publishFacebookTextPost,
    publishFacebookPhotoPost,
} from "../services/facebook.js";
import { getSessionCookie } from "../utils/auth.js";
import { withCors } from "../utils/cors.js";

const FACEBOOK_OAUTH_URL = "https://www.facebook.com/v24.0/dialog/oauth";
const DEFAULT_FRONTEND_URL = "http://localhost:8443";

const FACEBOOK_SCOPES = [
    "pages_show_list",
    "pages_read_engagement",
    "pages_manage_posts",
    "public_profile",
    "instagram_basic",
    "instagram_content_publish",
];

function getBackendCallbackUrl(request, env) {
    const url = new URL(request.url);
    const queryRedirect = url.searchParams.get("redirect_uri") || url.searchParams.get("callback_url");
    if (queryRedirect) {
        return queryRedirect;
    }
    if (env.FACEBOOK_REDIRECT_URI) {
        return env.FACEBOOK_REDIRECT_URI;
    }

    // When developing locally or connecting from localhost frontend
    const clientOrigin = request.headers.get("origin") || request.headers.get("referer") || url.searchParams.get("origin") || "";
    if (clientOrigin.includes("localhost") || clientOrigin.includes("127.0.0.1") || url.hostname === "localhost") {
        return "http://localhost:8787/api/facebook/callback";
    }

    // Default to http://localhost:8787/api/facebook/callback for local dev
    return "http://localhost:8787/api/facebook/callback";
}

function createStateCookie(state) {
    return [
        `facebook_oauth_state=${encodeURIComponent(state)}`,
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

/**
 * GET /api/facebook/auth
 * Initiates Facebook OAuth for the logged in user.
 */
export async function facebookAuth(request, env) {
    const requestUrl = new URL(request.url);

    // Identify user
    let userId = null;
    const sessionToken = getSessionCookie(request) || requestUrl.searchParams.get("token");
    if (sessionToken) {
        const session = await env.socialhub_db
            .prepare("SELECT user_id, expires_at FROM sessions WHERE session_token = ?")
            .bind(sessionToken)
            .first();
        if (session && new Date(session.expires_at) >= new Date()) {
            userId = session.user_id;
        }
    }

    if (!userId) {
        const paramUserId = requestUrl.searchParams.get("user_id");
        if (paramUserId) {
            const u = await env.socialhub_db.prepare("SELECT id FROM users WHERE id = ?").bind(paramUserId).first();
            if (u) userId = u.id;
        }
    }

    if (!userId) {
        // Fallback to most recently active user
        const lastUser = await env.socialhub_db
            .prepare("SELECT id FROM users ORDER BY last_login_at DESC, created_at DESC LIMIT 1")
            .first();
        if (lastUser) {
            userId = lastUser.id;
        }
    }

    if (!userId) {
        return withCors(new Response(
            JSON.stringify({ success: false, error: "Please log in first before connecting Facebook." }),
            { status: 401, headers: { "Content-Type": "application/json" } }
        ));
    }

    try {
        // Determine frontend origin for redirect
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

        // State format: nonce|userId|frontendOrigin|redirectUri
        const nonce = crypto.randomUUID();
        const statePayload = `${nonce}|${userId}|${frontendOrigin}|${encodeURIComponent(redirectUri)}`;

        if (!env.FACEBOOK_APP_ID) {
            return withCors(new Response(
                JSON.stringify({ success: false, error: "FACEBOOK_APP_ID is not configured in backend environment." }),
                { status: 500, headers: { "Content-Type": "application/json" } }
            ), request);
        }

        const authUrl = new URL(FACEBOOK_OAUTH_URL);
        authUrl.searchParams.set("client_id", env.FACEBOOK_APP_ID);
        authUrl.searchParams.set("redirect_uri", redirectUri);
        authUrl.searchParams.set("state", statePayload);
        authUrl.searchParams.set("scope", FACEBOOK_SCOPES.join(","));

        return new Response(null, {
            status: 302,
            headers: {
                Location: authUrl.toString(),
                "Set-Cookie": createStateCookie(statePayload),
            },
        });
    } catch (err) {
        console.error("facebookAuth error:", err);
        return withCors(new Response(
            JSON.stringify({ success: false, error: err.message || "Failed to initiate Facebook OAuth" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        ), request);
    }
}

/**
 * GET /api/facebook/callback
 * Handles OAuth callback from Facebook, exchanges token, saves pages, and redirects to frontend.
 */
export async function facebookCallback(request, env) {
    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get("code");
    const state = requestUrl.searchParams.get("state");
    const error = requestUrl.searchParams.get("error");
    const errorDescription = requestUrl.searchParams.get("error_description");

    // Parse state
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

    const frontendCallbackUrl = `${targetOrigin}/facebook/callback`;

    // Handle user cancelling or denial
    if (error) {
        const errMsg = errorDescription || "Facebook authorization was denied.";
        return new Response(null, {
            status: 302,
            headers: {
                Location: `${frontendCallbackUrl}?error=${encodeURIComponent(errMsg)}`,
                "Set-Cookie": "facebook_oauth_state=; Path=/; Max-Age=0",
            },
        });
    }

    if (!code) {
        return new Response(null, {
            status: 302,
            headers: {
                Location: `${frontendCallbackUrl}?error=${encodeURIComponent("Authorization code is missing.")}`,
                "Set-Cookie": "facebook_oauth_state=; Path=/; Max-Age=0",
            },
        });
    }

    // Verify state cookie if present (soft check in dev)
    const savedState = getCookie(request, "facebook_oauth_state");
    if (savedState && state && savedState !== state) {
        console.warn("State mismatch warning: saved", savedState, "received", state);
    }

    if (!userId) {
        // Fallback to most recently active user
        const lastUser = await env.socialhub_db
            .prepare("SELECT id FROM users ORDER BY last_login_at DESC, created_at DESC LIMIT 1")
            .first();
        if (lastUser) {
            userId = lastUser.id;
        } else {
            return new Response(null, {
                status: 302,
                headers: {
                    Location: `${frontendCallbackUrl}?error=${encodeURIComponent("Could not identify authenticated user.")}`,
                    "Set-Cookie": "facebook_oauth_state=; Path=/; Max-Age=0",
                },
            });
        }
    }

    try {
        const redirectUri = storedRedirectUri || getBackendCallbackUrl(request, env);

        // Exchange code for user token
        const tokenData = await exchangeCodeForUserToken(code, redirectUri, env);
        const userAccessToken = tokenData.access_token;

        // Fetch ALL pages the user manages (with linked Instagram accounts)
        const pages = await getFacebookPages(userAccessToken);

        if (!pages || pages.length === 0) {
            return new Response(null, {
                status: 302,
                headers: {
                    Location: `${frontendCallbackUrl}?error=${encodeURIComponent("No Facebook Pages found. Please make sure you manage at least one Facebook Page.")}`,
                    "Set-Cookie": "facebook_oauth_state=; Path=/; Max-Age=0",
                },
            });
        }

        // Store the full pages list (with tokens) in D1 pending_oauth_sessions.
        // The frontend will show a picker, user selects a page, then POSTs back.
        const pendingKey = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

        const pagesPayload = pages.map((p) => ({
            id: p.id,
            name: p.name,
            category: p.category || "Facebook Page",
            access_token: p.access_token,
            instagram: p.instagram_business_account
                ? {
                    id: p.instagram_business_account.id,
                    username: p.instagram_business_account.username,
                    name: p.instagram_business_account.name,
                    profile_picture_url: p.instagram_business_account.profile_picture_url,
                }
                : null,
        }));

        await env.socialhub_db
            .prepare(`
                INSERT INTO pending_oauth_sessions (id, user_id, platform, payload, expires_at)
                VALUES (?, ?, 'facebook', ?, ?)
                ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, expires_at = excluded.expires_at
            `)
            .bind(pendingKey, userId, JSON.stringify(pagesPayload), expiresAt)
            .run();

        // Send token-free list to frontend for user to pick from
        const safePages = pagesPayload.map((p) => ({
            id: p.id,
            name: p.name,
            category: p.category,
            hasInstagram: Boolean(p.instagram),
            instagram: p.instagram
                ? { id: p.instagram.id, username: p.instagram.username }
                : null,
        }));

        const params = new URLSearchParams({
            pending: pendingKey,
            platform: "facebook",
            pages: JSON.stringify(safePages),
        });

        return new Response(null, {
            status: 302,
            headers: {
                Location: `${frontendCallbackUrl}?${params.toString()}`,
                "Set-Cookie": "facebook_oauth_state=; Path=/; Max-Age=0",
            },
        });
    } catch (err) {
        console.error("Facebook OAuth callback error:", err);
        return new Response(null, {
            status: 302,
            headers: {
                Location: `${frontendCallbackUrl}?error=${encodeURIComponent(err.message || "Failed to exchange token with Facebook.")}`,
                "Set-Cookie": "facebook_oauth_state=; Path=/; Max-Age=0",
            },
        });
    }
}

// Helper to resolve user from session cookie or fallback
async function resolveUserIdFb(request, env) {
    const sessionToken = getSessionCookie(request);
    if (sessionToken) {
        const session = await env.socialhub_db
            .prepare("SELECT user_id, expires_at FROM sessions WHERE session_token = ?")
            .bind(sessionToken)
            .first();
        if (session && new Date(session.expires_at) >= new Date()) return session.user_id;
    }
    const lastUser = await env.socialhub_db
        .prepare("SELECT id FROM users ORDER BY last_login_at DESC, created_at DESC LIMIT 1")
        .first();
    return lastUser ? lastUser.id : null;
}

/**
 * POST /api/facebook/pages/select
 * Called from the frontend after user picks which Facebook page to connect.
 * Reads the pending_oauth_sessions record and saves only the selected page + linked Instagram.
 */
export async function selectFacebookPage(request, env) {
    const userId = await resolveUserIdFb(request, env);
    if (!userId) {
        return withCors(new Response(
            JSON.stringify({ success: false, error: "Unauthorized" }),
            { status: 401, headers: { "Content-Type": "application/json" } }
        ), request);
    }

    let pendingKey, selectedPageId;
    try {
        const body = await request.json();
        pendingKey = body.pendingKey;
        selectedPageId = body.pageId;
    } catch {
        return withCors(new Response(
            JSON.stringify({ success: false, error: "Invalid JSON body." }),
            { status: 400, headers: { "Content-Type": "application/json" } }
        ), request);
    }

    if (!pendingKey || !selectedPageId) {
        return withCors(new Response(
            JSON.stringify({ success: false, error: "pendingKey and pageId are required." }),
            { status: 400, headers: { "Content-Type": "application/json" } }
        ), request);
    }

    // Load pending OAuth session
    const pending = await env.socialhub_db
        .prepare("SELECT payload, expires_at FROM pending_oauth_sessions WHERE id = ? AND platform = 'facebook'")
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
            JSON.stringify({ success: false, error: "Session has expired. Please reconnect Facebook." }),
            { status: 410, headers: { "Content-Type": "application/json" } }
        ), request);
    }

    const allPages = JSON.parse(pending.payload);
    const selectedPage = allPages.find((p) => p.id === selectedPageId);

    if (!selectedPage) {
        return withCors(new Response(
            JSON.stringify({ success: false, error: "Selected page not found in session." }),
            { status: 404, headers: { "Content-Type": "application/json" } }
        ), request);
    }

    // Save the chosen Facebook Page
    await env.socialhub_db
        .prepare(`
            INSERT INTO facebook_pages (id, user_id, page_id, page_name, page_access_token, category, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id, page_id) DO UPDATE SET
                page_name = excluded.page_name,
                page_access_token = excluded.page_access_token,
                category = excluded.category,
                updated_at = CURRENT_TIMESTAMP
        `)
        .bind(crypto.randomUUID(), userId, selectedPage.id, selectedPage.name, selectedPage.access_token, selectedPage.category)
        .run();

    // Save the linked Instagram account if present
    if (selectedPage.instagram) {
        const ig = selectedPage.instagram;
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
                crypto.randomUUID(), userId, ig.id,
                ig.username || "instagram_user", ig.name || selectedPage.name,
                ig.profile_picture_url || null, selectedPage.id, selectedPage.access_token
            )
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
            page: { id: selectedPage.id, name: selectedPage.name, category: selectedPage.category },
            instagram: selectedPage.instagram
                ? { id: selectedPage.instagram.id, username: selectedPage.instagram.username }
                : null,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
    ), request);
}

/**
 * POST /api/facebook/pages/activate
 * Fast in-app switch of active Facebook Page without re-doing OAuth
 */
export async function activateFacebookPage(request, env) {
    const userId = await resolveUserIdFb(request, env);
    if (!userId) {
        return withCors(new Response(
            JSON.stringify({ success: false, error: "Unauthorized" }),
            { status: 401, headers: { "Content-Type": "application/json" } }
        ), request);
    }

    try {
        const body = await request.json();
        const pageId = body.pageId;
        if (!pageId) {
            return withCors(new Response(
                JSON.stringify({ success: false, error: "pageId is required" }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            ), request);
        }

        // Set updated_at to now for this page so it sorts first
        await env.socialhub_db
            .prepare("UPDATE facebook_pages SET updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND page_id = ?")
            .bind(userId, pageId)
            .run();

        // Also if this page has a linked instagram account, update that instagram account
        await env.socialhub_db
            .prepare("UPDATE instagram_accounts SET updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND page_id = ?")
            .bind(userId, pageId)
            .run();

        const page = await env.socialhub_db
            .prepare("SELECT page_id, page_name, category FROM facebook_pages WHERE user_id = ? AND page_id = ?")
            .bind(userId, pageId)
            .first();

        return withCors(new Response(
            JSON.stringify({ success: true, page }),
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
 * GET /api/facebook/pages
 * Returns the connected Facebook pages for the authenticated user, latest active first.
 */
export async function getFacebookPagesForUser(request, env) {
    const sessionToken = getSessionCookie(request);
    let userId = null;

    if (sessionToken) {
        const session = await env.socialhub_db
            .prepare("SELECT user_id, expires_at FROM sessions WHERE session_token = ?")
            .bind(sessionToken)
            .first();
        if (session && new Date(session.expires_at) >= new Date()) {
            userId = session.user_id;
        }
    }

    if (!userId) {
        const lastUser = await env.socialhub_db
            .prepare("SELECT id FROM users ORDER BY last_login_at DESC, created_at DESC LIMIT 1")
            .first();
        if (lastUser) userId = lastUser.id;
    }

    if (!userId) {
        return withCors(new Response(
            JSON.stringify({ success: false, error: "Unauthorized" }),
            { status: 401, headers: { "Content-Type": "application/json" } }
        ));
    }

    const { results } = await env.socialhub_db
        .prepare("SELECT page_id, page_name, category, updated_at FROM facebook_pages WHERE user_id = ? ORDER BY updated_at DESC, created_at DESC")
        .bind(userId)
        .all();

    return withCors(new Response(
        JSON.stringify({ success: true, pages: results || [] }),
        { status: 200, headers: { "Content-Type": "application/json" } }
    ));
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
 * POST /api/facebook/post (and POST /api/auth/facebook/post)
 * Publishes a post to a connected Facebook page.
 * Supports:
 * - Text-only posts
 * - Photo / Media posts via multipart/form-data (image file) or JSON (imageBase64 / imageUrl)
 */
export async function handleFacebookPost(request, env) {
    let pageId = null;
    let message = "";
    let imageFile = null;
    let imageUrl = null;

    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
        try {
            const formData = await request.formData();
            pageId = formData.get("pageId");
            message = formData.get("message") || formData.get("caption") || "";
            imageFile = formData.get("image") || formData.get("file");
            imageUrl = formData.get("imageUrl");
        } catch (e) {
            return withCors(new Response(
                JSON.stringify({ success: false, error: "Failed to parse form data: " + e.message }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            ), request);
        }
    } else {
        // application/json
        try {
            const body = await request.json();
            pageId = body.pageId;
            message = body.message || body.caption || "";
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

    if (!pageId) {
        return withCors(new Response(
            JSON.stringify({ success: false, error: "pageId is required." }),
            { status: 400, headers: { "Content-Type": "application/json" } }
        ), request);
    }

    // Must have either a message or an image
    const cleanMessage = message ? message.toString().trim() : "";
    if (!cleanMessage && !imageFile && !imageUrl) {
        return withCors(new Response(
            JSON.stringify({ success: false, error: "Please provide post text or an image." }),
            { status: 400, headers: { "Content-Type": "application/json" } }
        ), request);
    }

    // Lookup page access token and owner user_id in database
    const page = await env.socialhub_db
        .prepare("SELECT user_id, page_access_token, page_name FROM facebook_pages WHERE page_id = ? ORDER BY updated_at DESC LIMIT 1")
        .bind(pageId)
        .first();

    if (!page || !page.page_access_token) {
        return withCors(new Response(
            JSON.stringify({
                success: false,
                error: "This Facebook Page is not connected or token has expired. Please reconnect.",
            }),
            { status: 404, headers: { "Content-Type": "application/json" } }
        ), request);
    }

    // Determine user ID
    let userId = null;
    const sessionToken = getSessionCookie(request);
    if (sessionToken) {
        const session = await env.socialhub_db
            .prepare("SELECT user_id, expires_at FROM sessions WHERE session_token = ?")
            .bind(sessionToken)
            .first();
        if (session && new Date(session.expires_at) >= new Date()) {
            userId = session.user_id;
        }
    }
    if (!userId) {
        userId = page.user_id;
    }

    try {
        let r2Key = null;
        let mediaUrl = null;
        let fbImageSource = imageFile;

        // 1. SAVE IMAGE TO R2 STORAGE (socialhub-media)
        if (imageFile) {
            try {
                const arrayBuffer = await imageFile.arrayBuffer();
                fbImageSource = new Blob([arrayBuffer], { type: imageFile.type || 'image/jpeg' });

                if (env.socialhub_media) {
                    const originalName = imageFile.name ? imageFile.name.replace(/[^a-zA-Z0-9._-]/g, '_') : 'image.jpg';
                    const fileId = crypto.randomUUID();
                    r2Key = `posts/${userId}/${fileId}-${originalName}`;

                    await env.socialhub_media.put(r2Key, arrayBuffer, {
                        httpMetadata: {
                            contentType: imageFile.type || 'image/jpeg',
                        },
                        customMetadata: {
                            userId: userId,
                            channel: 'facebook',
                            pageId: pageId,
                            originalName: originalName,
                            uploadedAt: new Date().toISOString(),
                        },
                    });

                    const reqUrl = new URL(request.url);
                    mediaUrl = `${reqUrl.protocol}//${reqUrl.host}/api/media/${encodeURIComponent(r2Key)}`;
                }
            } catch (r2Err) {
                console.error("Warning: Error writing image to Cloudflare R2 bucket:", r2Err);
            }
        }

        // 2. PUBLISH TO FACEBOOK
        let result;
        if (imageFile || imageUrl) {
            result = await publishFacebookPhotoPost({
                pageId,
                pageAccessToken: page.page_access_token,
                caption: cleanMessage,
                imageFile: fbImageSource,
                imageUrl,
            });
        } else {
            result = await publishFacebookTextPost(
                pageId,
                page.page_access_token,
                cleanMessage
            );
        }

        const fbPostId = result.post_id || result.id;
        const mediaType = (imageFile || imageUrl) ? 'photo' : 'text';
        const recordId = crypto.randomUUID();

        // 3. SAVE POST HISTORY TO D1 DATABASE (posts table)
        try {
            await env.socialhub_db.prepare(`
                INSERT INTO posts (id, user_id, channel, page_id, page_name, post_id, message, media_key, media_url, media_type, status, created_at)
                VALUES (?, ?, 'facebook', ?, ?, ?, ?, ?, ?, ?, 'published', CURRENT_TIMESTAMP)
            `).bind(
                recordId,
                userId,
                pageId,
                page.page_name,
                fbPostId,
                cleanMessage || null,
                r2Key || null,
                mediaUrl || (imageUrl || null),
                mediaType
            ).run();
        } catch (dbErr) {
            console.error("Warning: Failed to record post in D1 database:", dbErr);
        }

        return withCors(new Response(
            JSON.stringify({
                success: true,
                type: mediaType,
                message: `${mediaType === 'photo' ? 'Photo' : 'Post'} published successfully to ${page.page_name}!`,
                postId: fbPostId,
                mediaKey: r2Key,
                mediaUrl: mediaUrl,
                savedToR2: Boolean(r2Key),
                savedToDatabase: true,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
        ), request);
    } catch (err) {
        console.error("Facebook post publishing error:", err);
        return withCors(new Response(
            JSON.stringify({
                success: false,
                error: err.message || "Failed to publish post to Facebook.",
            }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        ), request);
    }
}

/**
 * GET /api/posts
 * Returns post history for the authenticated user from D1 database.
 */
export async function handleGetPosts(request, env) {
    const sessionToken = getSessionCookie(request);
    let userId = null;

    if (sessionToken) {
        const session = await env.socialhub_db
            .prepare("SELECT user_id, expires_at FROM sessions WHERE session_token = ?")
            .bind(sessionToken)
            .first();
        if (session && new Date(session.expires_at) >= new Date()) {
            userId = session.user_id;
        }
    }

    if (!userId) {
        const lastUser = await env.socialhub_db
            .prepare("SELECT id FROM users ORDER BY last_login_at DESC, created_at DESC LIMIT 1")
            .first();
        if (lastUser) userId = lastUser.id;
    }

    if (!userId) {
        return withCors(new Response(
            JSON.stringify({ success: false, error: "Unauthorized" }),
            { status: 401, headers: { "Content-Type": "application/json" } }
        ), request);
    }

    const { results } = await env.socialhub_db
        .prepare("SELECT id, channel, page_name, post_id, message, media_key, media_url, media_type, status, created_at FROM posts WHERE user_id = ? ORDER BY created_at DESC LIMIT 50")
        .bind(userId)
        .all();

    return withCors(new Response(
        JSON.stringify({ success: true, posts: results || [] }),
        { status: 200, headers: { "Content-Type": "application/json" } }
    ), request);
}