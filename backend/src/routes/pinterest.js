import {
    exchangePinterestCodeForUserToken,
    getPinterestUserProfile,
    getPinterestBoards,
    publishPinterestPin,
} from "../services/pinterest.js";
import { getSessionCookie } from "../utils/auth.js";
import { withCors } from "../utils/cors.js";

const PINTEREST_OAUTH_URL = "https://www.pinterest.com/oauth/";
const DEFAULT_FRONTEND_URL = "http://localhost:8443";

const PINTEREST_SCOPES = [
    "user_accounts:read",
    "boards:read",
    "boards:write",
    "pins:read",
    "pins:write",
];

export async function ensurePinterestTable(db) {
    if (!db) return;
    try {
        await db.prepare(`
            CREATE TABLE IF NOT EXISTS pinterest_accounts (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                pinterest_user_id TEXT NOT NULL,
                username TEXT NOT NULL,
                business_name TEXT,
                profile_image TEXT,
                access_token TEXT NOT NULL,
                refresh_token TEXT,
                token_expires_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, pinterest_user_id),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `).run();
    } catch (e) {
        // Table might already exist or running in a mock context
        console.warn("ensurePinterestTable note:", e.message);
    }
}

function getBackendCallbackUrl(request, env) {
    const url = new URL(request.url);
    const queryRedirect = url.searchParams.get("redirect_uri") || url.searchParams.get("callback_url");
    if (queryRedirect) {
        return queryRedirect;
    }
    if (env.PINTEREST_REDIRECT_URI) {
        return env.PINTEREST_REDIRECT_URI;
    }

    const clientOrigin = request.headers.get("origin") || request.headers.get("referer") || url.searchParams.get("origin") || "";
    if (clientOrigin.includes("localhost") || clientOrigin.includes("127.0.0.1") || url.hostname === "localhost") {
        return "http://localhost:8787/api/pinterest/callback";
    }

    return "http://localhost:8787/api/pinterest/callback";
}

function createStateCookie(state) {
    return [
        `pinterest_oauth_state=${encodeURIComponent(state)}`,
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
 * GET /api/pinterest/auth (and GET /api/auth/pinterest/connect)
 * Initiates Pinterest OAuth 2.0 flow
 */
export async function pinterestAuth(request, env) {
    await ensurePinterestTable(env.socialhub_db);
    const requestUrl = new URL(request.url);
    const userId = await resolveUserId(request, env);

    if (!userId) {
        return withCors(new Response(
            JSON.stringify({ success: false, error: "Please log in first before connecting Pinterest." }),
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

        const appId = env.PINTEREST_APP_ID || "1630667";

        if (!appId) {
            return withCors(new Response(
                JSON.stringify({
                    success: false,
                    error: "PINTEREST_APP_ID is not configured in backend environment (.dev.vars). Please provide your Pinterest App credentials.",
                }),
                { status: 500, headers: { "Content-Type": "application/json" } }
            ), request);
        }

        const authUrl = new URL(PINTEREST_OAUTH_URL);
        authUrl.searchParams.set("client_id", appId);
        authUrl.searchParams.set("redirect_uri", redirectUri);
        authUrl.searchParams.set("response_type", "code");
        authUrl.searchParams.set("scope", PINTEREST_SCOPES.join(","));
        authUrl.searchParams.set("state", statePayload);


        return new Response(null, {
            status: 302,
            headers: {
                Location: authUrl.toString(),
                "Set-Cookie": createStateCookie(statePayload),
            },
        });
    } catch (err) {
        console.error("pinterestAuth error:", err);
        return withCors(new Response(
            JSON.stringify({ success: false, error: err.message || "Failed to initiate Pinterest OAuth" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        ), request);
    }
}

/**
 * GET /api/pinterest/callback
 * Handles OAuth callback from Pinterest, exchanges code for token, stores account, and redirects.
 */
export async function pinterestCallback(request, env) {
    await ensurePinterestTable(env.socialhub_db);
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

    const frontendCallbackUrl = `${targetOrigin}/pinterest/callback`;

    if (error) {
        const errMsg = errorDescription || error || "Pinterest authorization was denied.";
        return new Response(null, {
            status: 302,
            headers: {
                Location: `${frontendCallbackUrl}?error=${encodeURIComponent(errMsg)}`,
                "Set-Cookie": "pinterest_oauth_state=; Path=/; Max-Age=0",
            },
        });
    }

    if (!code) {
        return new Response(null, {
            status: 302,
            headers: {
                Location: `${frontendCallbackUrl}?error=${encodeURIComponent("Authorization code is missing.")}`,
                "Set-Cookie": "pinterest_oauth_state=; Path=/; Max-Age=0",
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
                "Set-Cookie": "pinterest_oauth_state=; Path=/; Max-Age=0",
            },
        });
    }

    try {
        const redirectUri = storedRedirectUri || getBackendCallbackUrl(request, env);
        const tokenData = await exchangePinterestCodeForUserToken(code, redirectUri, env);
        const accessToken = tokenData.access_token;
        const refreshToken = tokenData.refresh_token || null;
        const expiresIn = tokenData.expires_in || 2592000;
        const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

        // Retrieve user profile from Pinterest
        const profile = await getPinterestUserProfile(accessToken);
        const pinterestUserId = profile.id || profile.username || crypto.randomUUID();
        const username = profile.username || "pinterest_user";
        const businessName = profile.business_name || profile.username || "Pinterest User";
        const profileImage = profile.profile_image || null;

        // Save connected Pinterest account to database
        const accountRecordId = crypto.randomUUID();
        await env.socialhub_db
            .prepare(`
                INSERT INTO pinterest_accounts (
                    id, user_id, pinterest_user_id, username, business_name, profile_image,
                    access_token, refresh_token, token_expires_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(user_id, pinterest_user_id) DO UPDATE SET
                    username = excluded.username,
                    business_name = excluded.business_name,
                    profile_image = excluded.profile_image,
                    access_token = excluded.access_token,
                    refresh_token = excluded.refresh_token,
                    token_expires_at = excluded.token_expires_at,
                    updated_at = CURRENT_TIMESTAMP
            `)
            .bind(
                accountRecordId,
                userId,
                pinterestUserId,
                username,
                businessName,
                profileImage,
                accessToken,
                refreshToken,
                expiresAt
            )
            .run();

        // Also fetch boards in advance
        let boards = [];
        try {
            boards = await getPinterestBoards(accessToken);
        } catch (bErr) {
            console.warn("Could not pre-fetch boards on callback:", bErr.message);
        }

        const safeBoards = (boards || []).map((b) => ({
            id: b.id,
            name: b.name,
            privacy: b.privacy,
            description: b.description,
        }));

        const params = new URLSearchParams({
            platform: "pinterest",
            success: "true",
            username: username,
            accountId: pinterestUserId,
            name: businessName,
            boards: JSON.stringify(safeBoards),
        });

        return new Response(null, {
            status: 302,
            headers: {
                Location: `${frontendCallbackUrl}?${params.toString()}`,
                "Set-Cookie": "pinterest_oauth_state=; Path=/; Max-Age=0",
            },
        });
    } catch (err) {
        console.error("Pinterest OAuth callback error:", err);
        return new Response(null, {
            status: 302,
            headers: {
                Location: `${frontendCallbackUrl}?error=${encodeURIComponent(err.message || "Failed to exchange token with Pinterest.")}`,
                "Set-Cookie": "pinterest_oauth_state=; Path=/; Max-Age=0",
            },
        });
    }
}

/**
 * GET /api/pinterest/accounts
 * Returns all connected Pinterest accounts for the logged-in user
 */
export async function getPinterestAccountsForUser(request, env) {
    await ensurePinterestTable(env.socialhub_db);
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
                SELECT id, pinterest_user_id, username, business_name, profile_image, updated_at, created_at
                FROM pinterest_accounts
                WHERE user_id = ?
                ORDER BY updated_at DESC, created_at DESC
            `)
            .bind(userId)
            .all();

        return withCors(new Response(
            JSON.stringify({ success: true, accounts: results || [] }),
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
 * GET /api/pinterest/boards
 * Returns boards for the user's active Pinterest account
 */
export async function getPinterestBoardsForUser(request, env) {
    await ensurePinterestTable(env.socialhub_db);
    const userId = await resolveUserId(request, env);
    if (!userId) {
        return withCors(new Response(
            JSON.stringify({ success: false, error: "Unauthorized" }),
            { status: 401, headers: { "Content-Type": "application/json" } }
        ), request);
    }

    const url = new URL(request.url);
    const accountId = url.searchParams.get("accountId") || url.searchParams.get("pinterest_user_id");

    try {
        let account = null;
        if (accountId) {
            account = await env.socialhub_db
                .prepare("SELECT access_token, username FROM pinterest_accounts WHERE user_id = ? AND (pinterest_user_id = ? OR id = ?) LIMIT 1")
                .bind(userId, accountId, accountId)
                .first();
        } else {
            account = await env.socialhub_db
                .prepare("SELECT access_token, username FROM pinterest_accounts WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1")
                .bind(userId)
                .first();
        }

        if (!account || !account.access_token) {
            return withCors(new Response(
                JSON.stringify({ success: false, error: "No connected Pinterest account found. Please connect Pinterest first." }),
                { status: 404, headers: { "Content-Type": "application/json" } }
            ), request);
        }

        const boards = await getPinterestBoards(account.access_token);

        return withCors(new Response(
            JSON.stringify({ success: true, boards: boards || [] }),
            { status: 200, headers: { "Content-Type": "application/json" } }
        ), request);
    } catch (err) {
        return withCors(new Response(
            JSON.stringify({ success: false, error: err.message || "Failed to fetch Pinterest boards" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        ), request);
    }
}

/**
 * POST /api/pinterest/accounts/activate
 * Fast in-app switch of active Pinterest account
 */
export async function activatePinterestAccount(request, env) {
    await ensurePinterestTable(env.socialhub_db);
    const userId = await resolveUserId(request, env);
    if (!userId) {
        return withCors(new Response(
            JSON.stringify({ success: false, error: "Unauthorized" }),
            { status: 401, headers: { "Content-Type": "application/json" } }
        ), request);
    }

    try {
        const body = await request.json();
        const accountId = body.accountId || body.pinterest_user_id;

        if (!accountId) {
            return withCors(new Response(
                JSON.stringify({ success: false, error: "accountId is required" }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            ), request);
        }

        await env.socialhub_db
            .prepare("UPDATE pinterest_accounts SET updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND (pinterest_user_id = ? OR id = ?)")
            .bind(userId, accountId, accountId)
            .run();

        const account = await env.socialhub_db
            .prepare("SELECT id, pinterest_user_id, username, business_name, profile_image FROM pinterest_accounts WHERE user_id = ? AND (pinterest_user_id = ? OR id = ?)")
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
 * POST /api/pinterest/post (and POST /api/auth/pinterest/post)
 * Publishes a Pin to a user's Pinterest board.
 * Supports:
 * - Image file (multipart/form-data)
 * - Base64 image
 * - Public image URL
 */
export async function handlePinterestPost(request, env) {
    await ensurePinterestTable(env.socialhub_db);
    let boardId = null;
    let title = "";
    let description = "";
    let link = "";
    let accountId = null;
    let imageFile = null;
    let imageUrl = null;
    let imageBase64 = null;

    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
        try {
            const formData = await request.formData();
            boardId = formData.get("boardId");
            accountId = formData.get("accountId");
            title = formData.get("title") || "";
            description = formData.get("description") || formData.get("message") || formData.get("caption") || "";
            link = formData.get("link") || "";
            imageFile = formData.get("image") || formData.get("file");
            imageUrl = formData.get("imageUrl");
            imageBase64 = formData.get("imageBase64");
        } catch (e) {
            return withCors(new Response(
                JSON.stringify({ success: false, error: "Failed to parse form data: " + e.message }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            ), request);
        }
    } else {
        try {
            const body = await request.json();
            boardId = body.boardId;
            accountId = body.accountId;
            title = body.title || "";
            description = body.description || body.message || body.caption || "";
            link = body.link || "";
            imageUrl = body.imageUrl;
            imageBase64 = body.imageBase64;
        } catch {
            return withCors(new Response(
                JSON.stringify({ success: false, error: "Invalid JSON body." }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            ), request);
        }
    }

    if (!imageFile && !imageUrl && !imageBase64) {
        return withCors(new Response(
            JSON.stringify({ success: false, error: "Pinterest requires an image to create a Pin." }),
            { status: 400, headers: { "Content-Type": "application/json" } }
        ), request);
    }

    // Determine user
    let userId = await resolveUserId(request, env);

    // Retrieve active Pinterest account
    let account = null;
    if (accountId) {
        account = await env.socialhub_db
            .prepare("SELECT * FROM pinterest_accounts WHERE (pinterest_user_id = ? OR id = ?) LIMIT 1")
            .bind(accountId, accountId)
            .first();
    } else if (userId) {
        account = await env.socialhub_db
            .prepare("SELECT * FROM pinterest_accounts WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1")
            .bind(userId)
            .first();
    } else {
        account = await env.socialhub_db
            .prepare("SELECT * FROM pinterest_accounts ORDER BY updated_at DESC LIMIT 1")
            .first();
    }

    if (!account || !account.access_token) {
        return withCors(new Response(
            JSON.stringify({ success: false, error: "Please connect a Pinterest account before publishing." }),
            { status: 404, headers: { "Content-Type": "application/json" } }
        ), request);
    }

    if (!userId) {
        userId = account.user_id;
    }

    // If boardId wasn't specified, automatically find or use first user board
    if (!boardId) {
        try {
            const boards = await getPinterestBoards(account.access_token);
            if (boards && boards.length > 0) {
                boardId = boards[0].id;
            } else {
                return withCors(new Response(
                    JSON.stringify({ success: false, error: "No Pinterest boards found. Please create a board on Pinterest first." }),
                    { status: 400, headers: { "Content-Type": "application/json" } }
                ), request);
            }
        } catch (bErr) {
            return withCors(new Response(
                JSON.stringify({ success: false, error: "Could not retrieve boards: " + bErr.message }),
                { status: 500, headers: { "Content-Type": "application/json" } }
            ), request);
        }
    }

    try {
        let r2Key = null;
        let mediaUrl = null;

        // 1. SAVE TO R2 STORAGE (socialhub-media) if imageFile present
        if (imageFile && env.socialhub_media) {
            try {
                const arrayBuffer = await imageFile.arrayBuffer();
                const originalName = imageFile.name ? imageFile.name.replace(/[^a-zA-Z0-9._-]/g, '_') : 'pin.jpg';
                const fileId = crypto.randomUUID();
                r2Key = `posts/${userId}/${fileId}-${originalName}`;

                await env.socialhub_media.put(r2Key, arrayBuffer, {
                    httpMetadata: {
                        contentType: imageFile.type || 'image/jpeg',
                    },
                    customMetadata: {
                        userId: userId,
                        channel: 'pinterest',
                        boardId: boardId,
                        originalName: originalName,
                        uploadedAt: new Date().toISOString(),
                    },
                });

                const reqUrl = new URL(request.url);
                mediaUrl = `${reqUrl.protocol}//${reqUrl.host}/api/media/${encodeURIComponent(r2Key)}`;
            } catch (r2Err) {
                console.error("Warning: Error writing Pinterest image to R2:", r2Err);
            }
        }

        // 2. PUBLISH PIN TO PINTEREST API v5
        const pinResult = await publishPinterestPin({
            boardId,
            title: title || (description ? description.slice(0, 50) : "SocialHub Pin"),
            description: description || title || "",
            link,
            imageFile,
            imageUrl,
            imageBase64,
            accessToken: account.access_token,
        });

        // 3. RECORD IN POSTS TABLE
        const recordId = crypto.randomUUID();
        const combinedMessage = title ? (description ? `${title}\n\n${description}` : title) : description;

        await env.socialhub_db
            .prepare(`
                INSERT INTO posts (
                    id, user_id, channel, page_id, page_name, post_id,
                    message, media_key, media_url, media_type, status, created_at
                ) VALUES (?, ?, 'pinterest', ?, ?, ?, ?, ?, ?, 'photo', 'published', CURRENT_TIMESTAMP)
            `)
            .bind(
                recordId,
                userId,
                boardId,
                account.business_name || account.username || "Pinterest",
                pinResult.id,
                combinedMessage,
                r2Key,
                mediaUrl || imageUrl || null
            )
            .run();

        return withCors(new Response(
            JSON.stringify({
                success: true,
                postId: pinResult.id,
                channel: "pinterest",
                boardId,
                pin: pinResult,
                mediaUrl: mediaUrl || imageUrl || null,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
        ), request);
    } catch (err) {
        console.error("handlePinterestPost error:", err);
        return withCors(new Response(
            JSON.stringify({ success: false, error: err.message || "Failed to publish Pin to Pinterest" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        ), request);
    }
}
