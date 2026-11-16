const DEFAULT_TIKTOK_API_BASE = "https://open.tiktokapis.com/v2";
const DEFAULT_TIKTOK_AUTH_BASE = "https://www.tiktok.com/v2/auth/authorize/";

export const TIKTOK_SCOPES = [
    "user.info.basic",
    "video.publish",
    "video.upload",
];

/**
 * Get configured scopes from environment or default
 */
export function getTikTokScopes(env) {
    if (env?.TIKTOK_SCOPES) {
        return env.TIKTOK_SCOPES.split(",").map((s) => s.trim()).filter(Boolean);
    }
    return TIKTOK_SCOPES;
}

/**
 * Determine TikTok API Base URL
 */
export function getTikTokApiBase(env) {
    if (env?.TIKTOK_API_BASE) {
        return env.TIKTOK_API_BASE.replace(/\/+$/, "");
    }
    return DEFAULT_TIKTOK_API_BASE;
}

/**
 * Determine TikTok OAuth Authorize Base URL
 */
export function getTikTokAuthBase(env) {
    if (env?.TIKTOK_AUTH_BASE) {
        return env.TIKTOK_AUTH_BASE.replace(/\/+$/, "");
    }
    return DEFAULT_TIKTOK_AUTH_BASE;
}

/**
 * Convert ArrayBuffer to Base64URL string (for PKCE)
 */
export function base64UrlEncode(arrayBuffer) {
    const bytes = new Uint8Array(arrayBuffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}

/**
 * Convert Base64URL string back to Uint8Array
 */
export function base64UrlDecode(str) {
    let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) {
        base64 += "=";
    }
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

/**
 * Generate cryptographically secure PKCE Code Verifier
 */
export function generateCodeVerifier() {
    const randomBytes = new Uint8Array(32);
    crypto.getRandomValues(randomBytes);
    return base64UrlEncode(randomBytes);
}

/**
 * Generate PKCE Code Challenge from Verifier using SHA-256
 */
export async function generateCodeChallenge(verifier) {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return base64UrlEncode(digest);
}

/**
 * Build TikTok OAuth authorization URL
 * Note: For standard Login Kit for Web, TikTok uses authorization code grant without PKCE.
 * Passing code_challenge causes TikTok to trigger Bytedance desktop bridge (bytedance://dispatch_message/)
 * and check for desktop app registration, causing "client_key" error.
 * PKCE is only added if enablePkce is explicitly true or TIKTOK_ENABLE_PKCE is configured.
 */
export async function buildTikTokAuthUrl({ clientKey, redirectUri, state, scopes = TIKTOK_SCOPES, env, enablePkce = false }) {
    if (!clientKey) {
        throw new Error("TIKTOK_CLIENT_KEY is missing.");
    }
    const authBase = getTikTokAuthBase(env);
    const scopeString = Array.isArray(scopes) ? scopes.join(",") : String(scopes);

    const url = new URL(authBase);
    url.searchParams.set("client_key", clientKey.trim());
    url.searchParams.set("scope", scopeString);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("state", state);

    let verifier = null;
    if (enablePkce || env?.TIKTOK_ENABLE_PKCE === "true") {
        verifier = generateCodeVerifier();
        const challenge = await generateCodeChallenge(verifier);
        url.searchParams.set("code_challenge", challenge);
        url.searchParams.set("code_challenge_method", "S256");
    }

    return {
        url: url.toString(),
        codeVerifier: verifier,
    };
}

/**
 * Exchange authorization code for TikTok access token & refresh token
 */
export async function exchangeTikTokCodeForToken(code, redirectUri, env, codeVerifier = null) {
    const clientKey = env?.TIKTOK_CLIENT_KEY;
    const clientSecret = env?.TIKTOK_CLIENT_SECRET;

    if (!clientKey || !clientSecret) {
        throw new Error("TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET must be configured in environment secrets.");
    }

    const apiBase = getTikTokApiBase(env);
    const tokenUrl = `${apiBase}/oauth/token/`;

    const params = new URLSearchParams();
    params.set("client_key", clientKey);
    params.set("client_secret", clientSecret);
    params.set("code", code);
    params.set("grant_type", "authorization_code");
    params.set("redirect_uri", redirectUri);
    if (codeVerifier) {
        params.set("code_verifier", codeVerifier);
    }

    const response = await fetch(tokenUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Cache-Control": "no-cache",
        },
        body: params.toString(),
    });

    const data = await response.json();

    // Check for error either at top level or inside error object
    const errorCode = data?.error?.code || data?.error_code || data?.error;
    const errorMsg = data?.error?.message || data?.error_description || data?.message;

    if (!response.ok || (errorCode && errorCode !== "ok" && errorCode !== 0)) {
        console.error("TikTok token exchange error response:", data);
        const errMsg = errorMsg || `TikTok token exchange failed with error code: ${errorCode}`;
        if (response.status === 401 || response.status === 403 || String(errorCode).includes("invalid_client")) {
            throw new Error(`TikTok Authentication Failed (${response.status}): ${errMsg}. Please verify your TikTok Client Key & Secret.`);
        }
        throw new Error(errMsg);
    }

    // TikTok may return payload in `data` object or at root level
    const payload = data?.data && data.data.access_token ? data.data : data;

    if (!payload.access_token) {
        throw new Error("TikTok token exchange returned no access token.");
    }

    return payload;
}

/**
 * Refresh expired TikTok access token
 */
export async function refreshTikTokToken(refreshToken, env) {
    const clientKey = env?.TIKTOK_CLIENT_KEY;
    const clientSecret = env?.TIKTOK_CLIENT_SECRET;

    if (!clientKey || !clientSecret) {
        throw new Error("TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET must be configured.");
    }

    const apiBase = getTikTokApiBase(env);
    const tokenUrl = `${apiBase}/oauth/token/`;

    const params = new URLSearchParams();
    params.set("client_key", clientKey);
    params.set("client_secret", clientSecret);
    params.set("grant_type", "refresh_token");
    params.set("refresh_token", refreshToken);

    const response = await fetch(tokenUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Cache-Control": "no-cache",
        },
        body: params.toString(),
    });

    const data = await response.json();
    const errorCode = data?.error?.code || data?.error_code || data?.error;
    const errorMsg = data?.error?.message || data?.error_description || data?.message;

    if (!response.ok || (errorCode && errorCode !== "ok" && errorCode !== 0)) {
        console.error("TikTok refresh token error response:", data);
        throw new Error(errorMsg || `Failed to refresh TikTok access token: ${errorCode}`);
    }

    const payload = data?.data && data.data.access_token ? data.data : data;
    return payload;
}

/**
 * Revoke TikTok user access token (secure disconnect)
 */
export async function revokeTikTokToken(token, env) {
    const clientKey = env?.TIKTOK_CLIENT_KEY;
    const clientSecret = env?.TIKTOK_CLIENT_SECRET;

    if (!clientKey || !clientSecret || !token) {
        return { success: false, note: "Missing credentials or token" };
    }

    try {
        const apiBase = getTikTokApiBase(env);
        const revokeUrl = `${apiBase}/oauth/revoke/`;

        const params = new URLSearchParams();
        params.set("client_key", clientKey);
        params.set("client_secret", clientSecret);
        params.set("token", token);

        const response = await fetch(revokeUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: params.toString(),
        });

        const data = await response.json().catch(() => ({}));
        return { success: response.ok, data };
    } catch (err) {
        console.warn("TikTok token revocation warning:", err.message);
        return { success: false, error: err.message };
    }
}

/**
 * Retrieve TikTok user profile details
 * Scope required: user.info.basic
 */
export async function getTikTokUserProfile(accessToken, env) {
    if (!accessToken) {
        throw new Error("TikTok access token is required.");
    }

    const apiBase = getTikTokApiBase(env);
    const allFields = [
        "open_id",
        "union_id",
        "avatar_url",
        "avatar_url_100",
        "avatar_large_url",
        "display_name",
        "bio_description",
        "profile_deep_link",
        "is_verified",
        "username",
    ].join(",");

    let response = await fetch(`${apiBase}/user/info/?fields=${encodeURIComponent(allFields)}`, {
        method: "GET",
        headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
        },
    });

    let data = await response.json().catch(() => ({}));
    let errorCode = data?.error?.code || data?.error;

    // Fallback: If requesting all fields failed, retry with only basic user.info.basic fields
    if (!response.ok || (errorCode && errorCode !== "ok" && errorCode !== 0)) {
        const basicFields = ["open_id", "union_id", "avatar_url", "avatar_url_100", "avatar_large_url", "display_name"].join(",");
        response = await fetch(`${apiBase}/user/info/?fields=${encodeURIComponent(basicFields)}`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
        });
        data = await response.json().catch(() => ({}));
        errorCode = data?.error?.code || data?.error;
    }

    const errorMsg = data?.error?.message || data?.message;
    if (!response.ok || (errorCode && errorCode !== "ok" && errorCode !== 0)) {
        console.error("TikTok profile fetch error:", data);
        throw new Error(errorMsg || `Failed to fetch TikTok user profile: HTTP ${response.status}`);
    }

    const user = data?.data?.user || {};
    return {
        open_id: user.open_id || "",
        union_id: user.union_id || "",
        avatar_url: user.avatar_large_url || user.avatar_url_100 || user.avatar_url || "",
        display_name: user.display_name || user.username || "TikTok User",
        username: user.username || user.display_name || "tiktok_creator",
        bio_description: user.bio_description || "",
        is_verified: !!user.is_verified,
        profile_deep_link: user.profile_deep_link || "",
    };
}

/**
 * Query TikTok creator info (permissions, max duration, privacy options)
 */
export async function getTikTokCreatorInfo(accessToken, env) {
    if (!accessToken) {
        throw new Error("Access token is required.");
    }

    const apiBase = getTikTokApiBase(env);
    const creatorUrl = `${apiBase}/post/publish/creator_info/query/`;

    const response = await fetch(creatorUrl, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json; charset=UTF-8",
        },
        body: JSON.stringify({}),
    });

    const data = await response.json().catch(() => ({}));
    if (data?.data) {
        return data.data;
    }
    return null;
}

/**
 * Initialize TikTok video publish (Direct Post or Draft / Inbox upload)
 * Direct Post: POST /v2/post/publish/video/init/ (requires video.publish)
 * Draft / Inbox: POST /v2/post/publish/inbox/video/init/ (requires video.upload)
 */
export async function initVideoPublish(accessToken, {
    title = "",
    privacyLevel = "SELF_ONLY",
    disableComment = false,
    disableDuet = false,
    disableStitch = false,
    videoCoverTimestampMs = 1000,
    source = "FILE_UPLOAD",
    videoSize = 0,
    chunkSize = 0,
    totalChunkCount = 1,
    videoUrl = null,
    isDraft = false,
}, env) {
    if (!accessToken) {
        throw new Error("TikTok access token is required.");
    }

    const apiBase = getTikTokApiBase(env);
    const endpoint = isDraft
        ? `${apiBase}/post/publish/inbox/video/init/`
        : `${apiBase}/post/publish/video/init/`;

    const postInfo = {
        title: title ? title.slice(0, 2200) : "Video via SocialHub AI",
        privacy_level: privacyLevel || "SELF_ONLY",
        disable_duet: !!disableDuet,
        disable_stitch: !!disableStitch,
        disable_comment: !!disableComment,
        video_cover_timestamp_ms: videoCoverTimestampMs || 1000,
    };

    let sourceInfo = {};
    if (source === "PULL_FROM_URL" && videoUrl) {
        sourceInfo = {
            source: "PULL_FROM_URL",
            video_url: videoUrl,
        };
    } else {
        sourceInfo = {
            source: "FILE_UPLOAD",
            video_size: videoSize,
            chunk_size: chunkSize || videoSize,
            total_chunk_count: totalChunkCount || 1,
        };
    }

    const payload = isDraft
        ? { source_info: sourceInfo }
        : { post_info: postInfo, source_info: sourceInfo };

    const response = await fetch(endpoint, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json; charset=UTF-8",
        },
        body: JSON.stringify(payload),
    });

    const data = await response.json();
    const errorCode = data?.error?.code || data?.error;
    const errorMsg = data?.error?.message || data?.message;

    if (!response.ok || (errorCode && errorCode !== "ok" && errorCode !== 0)) {
        console.error(`TikTok video init failed (${endpoint}):`, data);

        if (
            errorCode === "unaudited_client_can_only_post_to_private_accounts" ||
            (typeof errorMsg === "string" && errorMsg.includes("unaudited_client_can_only_post_to_private_accounts"))
        ) {
            const auditErr = new Error("unaudited_client_can_only_post_to_private_accounts");
            auditErr.code = "unaudited_client_can_only_post_to_private_accounts";
            throw auditErr;
        }

        // If direct post fails because client is unaudited or lacks direct publish audit scope in Sandbox:
        const isAuditOrScopeIssue = /unaudited|audit|scope|permission|not_authorized/i.test(errorMsg || "") ||
            errorCode === "unaudited_client_can_only_post_to_inbox" ||
            errorCode === "access_token_has_no_audit_scope";

        if (!isDraft && isAuditOrScopeIssue) {
            console.log("Direct posting restricted; automatically retrying as Draft Upload (inbox)...");
            return await initVideoPublish(accessToken, {
                title,
                privacyLevel,
                disableComment,
                disableDuet,
                disableStitch,
                videoCoverTimestampMs,
                source,
                videoSize,
                chunkSize,
                totalChunkCount,
                videoUrl,
                isDraft: true,
            }, env);
        }

        throw new Error(errorMsg || `TikTok video initialization failed (Code: ${errorCode})`);
    }

    return {
        publishId: data?.data?.publish_id,
        uploadUrl: data?.data?.upload_url,
        isDraft: isDraft || endpoint.includes("/inbox/"),
        raw: data?.data,
    };
}

/**
 * Upload a video chunk to TikTok upload_url
 */
export async function uploadVideoChunk(uploadUrl, chunkBuffer, startByte, endByte, totalBytes, contentType = "video/mp4") {
    if (!uploadUrl) {
        throw new Error("TikTok upload URL is missing.");
    }

    const response = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
            "Content-Type": contentType || "video/mp4",
            "Content-Range": `bytes ${startByte}-${endByte}/${totalBytes}`,
            "Content-Length": `${chunkBuffer.byteLength}`,
        },
        body: chunkBuffer,
    });

    if (!response.ok && response.status !== 201 && response.status !== 206) {
        const text = await response.text().catch(() => "");
        throw new Error(`Failed to upload video chunk to TikTok: HTTP ${response.status} - ${text}`);
    }

    return { success: true, status: response.status };
}

/**
 * Map TikTok post status to internal posts.status:
 * PUBLISH_COMPLETE -> published
 * FAILED -> failed
 * SEND_TO_USER_INBOX -> draft_sent
 * anything else -> processing_upload
 */
export function mapTikTokStatus(status) {
    if (!status) return "processing_upload";
    const s = String(status).trim().toUpperCase();
    if (s === "PUBLISH_COMPLETE") return "published";
    if (s === "FAILED") return "failed";
    if (s === "SEND_TO_USER_INBOX") return "draft_sent";
    return "processing_upload";
}

/**
 * Fetch TikTok publish status safely
 * POST https://open.tiktokapis.com/v2/post/publish/status/fetch/
 */
export async function fetchPublishStatus(accessToken, publishId, env) {
    if (!accessToken || !publishId) {
        return null;
    }

    try {
        const apiBase = getTikTokApiBase(env);
        const statusUrl = `${apiBase}/post/publish/status/fetch/`;

        const res = await fetch(statusUrl, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "Content-Type": "application/json; charset=UTF-8",
            },
            body: JSON.stringify({ publish_id: publishId }),
        });

        const text = typeof res.text === "function" ? await res.text() : JSON.stringify(await res.json());
        let json;
        try {
            json = JSON.parse(text);
        } catch (parseErr) {
            console.error(`TikTok status fetch JSON parse failed (HTTP ${res.status}, url: ${res.url}): ${text.slice(0, 200)}`);
            return null;
        }

        const errorCode = json?.error?.code || json?.error;
        if (!res.ok || (errorCode && errorCode !== "ok" && errorCode !== 0)) {
            console.error(`TikTok status fetch error (HTTP ${res.status}, url: ${res.url}): ${text.slice(0, 200)}`);
            return null;
        }

        return {
            publishId,
            status: json?.data?.status || "UNKNOWN",
            failReason: json?.data?.fail_reason || null,
            publiclyAvailablePostId: json?.data?.publicly_available_post_id || null,
            data: json?.data,
            raw: json,
        };
    } catch (err) {
        console.error("fetchPublishStatus error:", err?.message || err);
        return null;
    }
}

// Backward-compatible alias
export const checkPublishStatus = fetchPublishStatus;

