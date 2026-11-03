const PINTEREST_API_BASE = "https://api.pinterest.com/v5";

/**
 * Robustly convert an ArrayBuffer to a Base64 string in Cloudflare Workers / Node
 */
export function arrayBufferToBase64(buffer) {
    let binary = "";
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    const chunkSize = 8192;
    for (let i = 0; i < len; i += chunkSize) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
}

/**
 * Exchange Pinterest authorization code for User Access Token & Refresh Token
 */
export async function exchangePinterestCodeForUserToken(code, redirectUri, env) {
    const appId = env.PINTEREST_APP_ID || "1630667";
    const appSecret = env.PINTEREST_APP_SECRET || "cbf323c02d2cbc764fb5ab5330e4b605629eb143";

    if (!appId || !appSecret) {
        throw new Error("PINTEREST_APP_ID and PINTEREST_APP_SECRET must be configured in backend environment.");
    }


    const tokenUrl = `${PINTEREST_API_BASE}/oauth/token`;
    const basicAuth = btoa(`${appId}:${appSecret}`);

    const params = new URLSearchParams();
    params.set("grant_type", "authorization_code");
    params.set("code", code);
    params.set("redirect_uri", redirectUri);
    params.set("continuous_refresh", "true");

    const response = await fetch(tokenUrl, {
        method: "POST",
        headers: {
            "Authorization": `Basic ${basicAuth}`,
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
    });

    const data = await response.json();

    if (!response.ok || data.code || data.error) {
        const errorMsg = data.message || data.error_description || data.error || "Failed to exchange authorization code for Pinterest access token";
        throw new Error(errorMsg);
    }

    return data;
}

/**
 * Get authenticated user's Pinterest profile details
 */
export async function getPinterestUserProfile(accessToken) {
    if (!accessToken) {
        throw new Error("Access token is required.");
    }

    const response = await fetch(`${PINTEREST_API_BASE}/user_account`, {
        headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
        },
    });

    const data = await response.json();

    if (!response.ok || data.code) {
        throw new Error(data.message || "Failed to retrieve Pinterest user profile");
    }

    return data;
}

/**
 * Retrieve user's Pinterest boards
 */
export async function getPinterestBoards(accessToken) {
    if (!accessToken) {
        throw new Error("Access token is required.");
    }

    const response = await fetch(`${PINTEREST_API_BASE}/boards?page_size=100`, {
        headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
        },
    });

    const data = await response.json();

    if (!response.ok || data.code) {
        throw new Error(data.message || "Failed to retrieve Pinterest boards");
    }

    return data.items || [];
}

/**
 * Create a new Pinterest board if needed
 */
export async function createPinterestBoard(accessToken, { name, description = "", privacy = "PUBLIC" }) {
    if (!accessToken) {
        throw new Error("Access token is required.");
    }

    const response = await fetch(`${PINTEREST_API_BASE}/boards`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            name,
            description,
            privacy,
        }),
    });

    const data = await response.json();

    if (!response.ok || data.code) {
        throw new Error(data.message || "Failed to create Pinterest board");
    }

    return data;
}

/**
 * Publish a Pin to Pinterest
 * Supports:
 * - Direct image_base64
 * - Hosted image_url
 * - imageFile (Blob/File) converted automatically to base64
 */
export async function publishPinterestPin({
    boardId,
    title = "",
    description = "",
    link = "",
    imageFile = null,
    imageUrl = null,
    imageBase64 = null,
    imageContentType = "image/jpeg",
    accessToken,
}) {
    if (!accessToken) {
        throw new Error("Pinterest access token is required.");
    }

    if (!boardId) {
        throw new Error("Pinterest Board ID is required to publish a Pin.");
    }

    let mediaSource = null;

    if (imageBase64) {
        // Strip data:image/...;base64, prefix if present
        const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, "");
        // Normalize content_type: Pinterest accepts image/jpeg, image/png
        let normalizedType = imageContentType || "image/jpeg";
        if (normalizedType.includes("png")) normalizedType = "image/png";
        else normalizedType = "image/jpeg";

        mediaSource = {
            source_type: "image_base64",
            content_type: normalizedType,
            data: cleanBase64,
        };
    } else if (imageFile) {
        let type = imageFile.type || "image/jpeg";
        if (type.includes("png")) type = "image/png";
        else type = "image/jpeg";

        const arrayBuffer = await imageFile.arrayBuffer();
        const base64Data = arrayBufferToBase64(arrayBuffer);

        mediaSource = {
            source_type: "image_base64",
            content_type: type,
            data: base64Data,
        };
    } else if (imageUrl) {
        mediaSource = {
            source_type: "image_url",
            url: imageUrl,
        };
    } else {
        throw new Error("An image (file, base64, or image URL) is required to create a Pin on Pinterest.");
    }

    const payload = {
        board_id: boardId,
        title: title ? title.slice(0, 100) : "",
        description: description ? description.slice(0, 500) : "",
        media_source: mediaSource,
    };

    if (link && link.trim()) {
        payload.link = link.trim();
    }

    const response = await fetch(`${PINTEREST_API_BASE}/pins`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok || data.code) {
        throw new Error(data.message || data.details || "Failed to create Pin on Pinterest");
    }

    return data;
}
