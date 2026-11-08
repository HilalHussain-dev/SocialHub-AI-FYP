import {
    exchangeLinkedInCodeForToken,
    getLinkedInUserProfile,
    getLinkedInProfilePicture,
    publishLinkedInTextPost,
    publishLinkedInImagePost,
} from "../services/linkedin.js";
import { getSessionCookie } from "../utils/auth.js";
import { withCors } from "../utils/cors.js";

const LINKEDIN_OAUTH_URL = "https://www.linkedin.com/oauth/v2/authorization";
const DEFAULT_FRONTEND_URL = "http://localhost:8443";

const LINKEDIN_SCOPES = [
    "openid",
    "profile",
    "email",
    "w_member_social",
];

/**
 * Ensure linkedin_accounts table exists in D1
 */
export async function ensureLinkedInTable(db) {
    if (!db) return;
    try {
        await db.prepare(`
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
            )
        `).run();
    } catch (e) {
        console.warn("ensureLinkedInTable note:", e.message);
    }
}

function getBackendCallbackUrl(request, env) {
    const url = new URL(request.url);
    const queryRedirect = url.searchParams.get("redirect_uri") || url.searchParams.get("callback_url");
    if (queryRedirect) {
        return queryRedirect;
    }
    if (env.LINKEDIN_REDIRECT_URI) {
        return env.LINKEDIN_REDIRECT_URI;
    }

    const clientOrigin = request.headers.get("origin") || request.headers.get("referer") || url.searchParams.get("origin") || "";
    if (clientOrigin.includes("localhost") || clientOrigin.includes("127.0.0.1") || url.hostname === "localhost") {
        return "http://localhost:8787/api/linkedin/callback";
    }

    return "http://localhost:8787/api/linkedin/callback";
}

function createStateCookie(state) {
    return [
        `linkedin_oauth_state=${encodeURIComponent(state)}`,
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
 * GET /api/linkedin/auth (and GET /api/auth/linkedin/connect)
 * Initiates LinkedIn OAuth 2.0 flow
 */
export async function linkedinAuth(request, env) {
    await ensureLinkedInTable(env.socialhub_db);
    const requestUrl = new URL(request.url);
    const userId = await resolveUserId(request, env);

    if (!userId) {
        return withCors(new Response(
            JSON.stringify({ success: false, error: "Please log in first before connecting LinkedIn." }),
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

        const clientId = env?.LINKEDIN_CLIENT_ID;

        if (!clientId) {
            return withCors(new Response(
                JSON.stringify({
                    success: false,
                    error: "LINKEDIN_CLIENT_ID is not configured in backend environment (.dev.vars). Please provide your LinkedIn App credentials.",
                }),
                { status: 500, headers: { "Content-Type": "application/json" } }
            ), request);
        }

        const authUrl = new URL(LINKEDIN_OAUTH_URL);
        authUrl.searchParams.set("response_type", "code");
        authUrl.searchParams.set("client_id", clientId);
        authUrl.searchParams.set("redirect_uri", redirectUri);
        authUrl.searchParams.set("scope", LINKEDIN_SCOPES.join(" "));
        authUrl.searchParams.set("state", statePayload);

        return new Response(null, {
            status: 302,
            headers: {
                Location: authUrl.toString(),
                "Set-Cookie": createStateCookie(statePayload),
            },
        });
    } catch (err) {
        console.error("linkedinAuth error:", err);
        return withCors(new Response(
            JSON.stringify({ success: false, error: err.message || "Failed to initiate LinkedIn OAuth" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        ), request);
    }
}

/**
 * GET /api/linkedin/callback
 * Handles OAuth callback from LinkedIn, exchanges code for token, stores account, and redirects.
 */
export async function linkedinCallback(request, env) {
    await ensureLinkedInTable(env.socialhub_db);
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

    const frontendCallbackUrl = `${targetOrigin}/linkedin/callback`;

    if (error) {
        const errMsg = errorDescription || error || "LinkedIn authorization was denied.";
        return new Response(null, {
            status: 302,
            headers: {
                Location: `${frontendCallbackUrl}?error=${encodeURIComponent(errMsg)}`,
                "Set-Cookie": "linkedin_oauth_state=; Path=/; Max-Age=0",
            },
        });
    }

    if (!code) {
        return new Response(null, {
            status: 302,
            headers: {
                Location: `${frontendCallbackUrl}?error=${encodeURIComponent("Authorization code is missing.")}`,
                "Set-Cookie": "linkedin_oauth_state=; Path=/; Max-Age=0",
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
                "Set-Cookie": "linkedin_oauth_state=; Path=/; Max-Age=0",
            },
        });
    }

    try {
        const redirectUri = storedRedirectUri || getBackendCallbackUrl(request, env);
        const tokenData = await exchangeLinkedInCodeForToken(code, redirectUri, env);
        const accessToken = tokenData.access_token;
        const expiresIn = tokenData.expires_in || 5184000; // Default 60 days
        const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

        // Retrieve user profile from LinkedIn
        const profile = await getLinkedInUserProfile(accessToken);
        const linkedinId = profile.sub || profile.id || crypto.randomUUID();
        const linkedinUrn = `urn:li:person:${linkedinId}`;
        const name = `${profile.given_name || ""} ${profile.family_name || ""}`.trim() || profile.name || "LinkedIn User";
        const email = profile.email || null;
        
        // Try to get profile picture
        const profilePicture = await getLinkedInProfilePicture(accessToken, linkedinId).catch(() => null);

        // Save connected LinkedIn account to database
        const accountRecordId = crypto.randomUUID();
        await env.socialhub_db
            .prepare(`
                INSERT INTO linkedin_accounts (
                    id, user_id, linkedin_id, linkedin_urn, name, email, profile_picture,
                    access_token, token_expires_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(user_id, linkedin_id) DO UPDATE SET
                    linkedin_urn = excluded.linkedin_urn,
                    name = excluded.name,
                    email = excluded.email,
                    profile_picture = excluded.profile_picture,
                    access_token = excluded.access_token,
                    token_expires_at = excluded.token_expires_at,
                    updated_at = CURRENT_TIMESTAMP
            `)
            .bind(
                accountRecordId,
                userId,
                linkedinId,
                linkedinUrn,
                name,
                email,
                profilePicture,
                accessToken,
                expiresAt
            )
            .run();

        const params = new URLSearchParams({
            platform: "linkedin",
            success: "true",
            name: name,
            accountId: linkedinId,
            email: email || "",
        });

        return new Response(null, {
            status: 302,
            headers: {
                Location: `${frontendCallbackUrl}?${params.toString()}`,
                "Set-Cookie": "linkedin_oauth_state=; Path=/; Max-Age=0",
            },
        });
    } catch (err) {
        console.error("LinkedIn OAuth callback error:", err);
        return new Response(null, {
            status: 302,
            headers: {
                Location: `${frontendCallbackUrl}?error=${encodeURIComponent(err.message || "Failed to exchange token with LinkedIn.")}`,
                "Set-Cookie": "linkedin_oauth_state=; Path=/; Max-Age=0",
            },
        });
    }
}

/**
 * GET /api/linkedin/accounts
 * Returns all connected LinkedIn accounts for the logged-in user
 */
export async function getLinkedInAccountsForUser(request, env) {
    await ensureLinkedInTable(env.socialhub_db);
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
                SELECT id, linkedin_id, linkedin_urn, name, email, profile_picture, updated_at, created_at
                FROM linkedin_accounts
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
 * POST /api/linkedin/accounts/activate
 * Fast in-app switch of active LinkedIn account
 */
export async function activateLinkedInAccount(request, env) {
    await ensureLinkedInTable(env.socialhub_db);
    const userId = await resolveUserId(request, env);
    if (!userId) {
        return withCors(new Response(
            JSON.stringify({ success: false, error: "Unauthorized" }),
            { status: 401, headers: { "Content-Type": "application/json" } }
        ), request);
    }

    try {
        const body = await request.json();
        const accountId = body.accountId || body.linkedin_id;

        if (!accountId) {
            return withCors(new Response(
                JSON.stringify({ success: false, error: "accountId is required" }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            ), request);
        }

        await env.socialhub_db
            .prepare("UPDATE linkedin_accounts SET updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND (linkedin_id = ? OR id = ?)")
            .bind(userId, accountId, accountId)
            .run();

        const account = await env.socialhub_db
            .prepare("SELECT id, linkedin_id, linkedin_urn, name, email, profile_picture FROM linkedin_accounts WHERE user_id = ? AND (linkedin_id = ? OR id = ?)")
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
 * POST /api/linkedin/post (and POST /api/auth/linkedin/post)
 * Publishes a post to LinkedIn.
 * Supports:
 * - Text-only posts
 * - Image posts (multipart/form-data or base64)
 */
export async function handleLinkedInPost(request, env) {
    await ensureLinkedInTable(env.socialhub_db);
    let accountId = null;
    let message = "";
    let imageFile = null;
    let imageBase64 = null;

    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
        try {
            const formData = await request.formData();
            accountId = formData.get("accountId") || formData.get("linkedin_id");
            message = formData.get("message") || formData.get("text") || formData.get("caption") || "";
            imageFile = formData.get("image") || formData.get("file");
        } catch (e) {
            return withCors(new Response(
                JSON.stringify({ success: false, error: "Failed to parse form data: " + e.message }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            ), request);
        }
    } else {
        try {
            const body = await request.json();
            accountId = body.accountId || body.linkedin_id;
            message = body.message || body.text || body.caption || "";
            imageBase64 = body.imageBase64 || body.image_base64;
            
            // Handle base64 from imageUrl field if it starts with data:
            if (body.imageUrl && body.imageUrl.startsWith("data:")) {
                imageBase64 = body.imageUrl;
            }
        } catch {
            return withCors(new Response(
                JSON.stringify({ success: false, error: "Invalid JSON body." }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            ), request);
        }
    }

    // Determine user
    let userId = await resolveUserId(request, env);

    // Retrieve active LinkedIn account
    let account = null;
    if (accountId) {
        account = await env.socialhub_db
            .prepare("SELECT * FROM linkedin_accounts WHERE (linkedin_id = ? OR id = ?) LIMIT 1")
            .bind(accountId, accountId)
            .first();
    } else if (userId) {
        account = await env.socialhub_db
            .prepare("SELECT * FROM linkedin_accounts WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1")
            .bind(userId)
            .first();
    } else {
        account = await env.socialhub_db
            .prepare("SELECT * FROM linkedin_accounts ORDER BY updated_at DESC LIMIT 1")
            .first();
    }

    if (!account || !account.access_token) {
        return withCors(new Response(
            JSON.stringify({ success: false, error: "Please connect a LinkedIn account before publishing." }),
            { status: 404, headers: { "Content-Type": "application/json" } }
        ), request);
    }

    if (!userId) {
        userId = account.user_id || "direct_user";
    }

    const cleanMessage = message ? message.toString().trim() : "";

    if (!cleanMessage && !imageFile && !imageBase64) {
        return withCors(new Response(
            JSON.stringify({ success: false, error: "Please provide post text or an image." }),
            { status: 400, headers: { "Content-Type": "application/json" } }
        ), request);
    }

    try {
        let r2Key = null;
        let mediaUrl = null;
        let linkedInImageData = imageFile || imageBase64;

        // Save image to R2 if provided
        if (imageFile && typeof imageFile.arrayBuffer === "function") {
            try {
                const arrayBuffer = await imageFile.arrayBuffer();
                const finalImageContentType = imageFile.type || "image/jpeg";

                if (env.socialhub_media) {
                    const originalName = imageFile.name ? imageFile.name.replace(/[^a-zA-Z0-9._-]/g, '_') : 'linkedin.jpg';
                    const fileId = crypto.randomUUID();
                    r2Key = `posts/${userId}/${fileId}-${originalName}`;

                    await env.socialhub_media.put(r2Key, arrayBuffer, {
                        httpMetadata: {
                            contentType: finalImageContentType,
                        },
                        customMetadata: {
                            userId: userId,
                            channel: 'linkedin',
                            originalName: originalName,
                            uploadedAt: new Date().toISOString(),
                        },
                    });

                    const reqUrl = new URL(request.url);
                    mediaUrl = `${reqUrl.protocol}//${reqUrl.host}/api/media/${encodeURIComponent(r2Key)}`;
                }
            } catch (r2Err) {
                console.error("Warning: Error writing LinkedIn image to R2:", r2Err);
            }
        }

        // Publish to LinkedIn
        let result;
        if (imageFile || imageBase64) {
            result = await publishLinkedInImagePost({
                accessToken: account.access_token,
                profileUrn: account.linkedin_urn,
                text: cleanMessage,
                imageFile: linkedInImageData,
            });
        } else {
            result = await publishLinkedInTextPost(
                account.access_token,
                account.linkedin_urn,
                cleanMessage
            );
        }

        const linkedInPostId = result.id;
        const mediaType = (imageFile || imageBase64) ? 'image' : 'text';
        const recordId = crypto.randomUUID();

        // Save post history to D1 database
        try {
            await env.socialhub_db.prepare(`
                INSERT INTO posts (id, user_id, channel, page_id, page_name, post_id, message, media_key, media_url, media_type, status, created_at)
                VALUES (?, ?, 'linkedin', ?, ?, ?, ?, ?, ?, ?, 'published', CURRENT_TIMESTAMP)
            `).bind(
                recordId,
                userId,
                account.linkedin_id,
                account.name,
                linkedInPostId,
                cleanMessage || null,
                r2Key || null,
                mediaUrl || null,
                mediaType
            ).run();
        } catch (dbErr) {
            console.error("Warning: Failed to record post in D1 database:", dbErr);
        }

        return withCors(new Response(
            JSON.stringify({
                success: true,
                type: mediaType,
                message: `${mediaType === 'image' ? 'Image post' : 'Post'} published successfully to LinkedIn!`,
                postId: linkedInPostId,
                mediaKey: r2Key,
                mediaUrl: mediaUrl,
                savedToR2: Boolean(r2Key),
                savedToDatabase: true,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
        ), request);
    } catch (err) {
        console.error("LinkedIn post publishing error:", err);
        return withCors(new Response(
            JSON.stringify({
                success: false,
                error: err.message || "Failed to publish post to LinkedIn.",
            }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        ), request);
    }
}
