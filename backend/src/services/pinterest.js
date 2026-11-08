const DEFAULT_PINTEREST_API_BASE = "https://api.pinterest.com/v5";

/**
 * Determine Pinterest API Base URL (Production vs Sandbox)
 */
export function getPinterestApiBase(env) {
    if (env?.PINTEREST_API_BASE) {
        return env.PINTEREST_API_BASE.replace(/\/+$/, "");
    }
    if (env?.PINTEREST_USE_SANDBOX === "true" || env?.PINTEREST_ENVIRONMENT === "sandbox") {
        return "https://api-sandbox.pinterest.com/v5";
    }
    return DEFAULT_PINTEREST_API_BASE;
}

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
    const appId = env?.PINTEREST_APP_ID;
    const appSecret = env?.PINTEREST_APP_SECRET;

    if (!appId || !appSecret) {
        throw new Error("PINTEREST_APP_ID and PINTEREST_APP_SECRET must be configured in backend environment.");
    }

    const apiBase = getPinterestApiBase(env);
    const tokenUrl = `${apiBase}/oauth/token`;
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
        console.error(`Pinterest code exchange failed (HTTP ${response.status}): ${errorMsg}`);
        const isSandbox = apiBase.includes("sandbox") || env?.PINTEREST_USE_SANDBOX === "true";
        if ((response.status === 401 || response.status === 403) && isSandbox) {
            throw new Error(
                `Pinterest Sandbox Authentication Error (HTTP ${response.status}): Code exchange failed against api-sandbox.pinterest.com (${errorMsg}). ` +
                "Please verify that your Pinterest App credentials match the Sandbox environment."
            );
        }
        throw new Error(errorMsg);
    }

    return data;
}

/**
 * Get authenticated user's Pinterest profile details
 */
export async function getPinterestUserProfile(accessToken, env) {
    if (!accessToken) {
        throw new Error("Access token is required.");
    }

    const apiBase = getPinterestApiBase(env);
    const response = await fetch(`${apiBase}/user_account`, {
        headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
        },
    });

    const data = await response.json();

    if (!response.ok || data.code) {
        console.error(`Failed to retrieve Pinterest user profile (HTTP ${response.status}): ${data.message || "Unknown error"}`);
        const isSandbox = apiBase.includes("sandbox") || env?.PINTEREST_USE_SANDBOX === "true";
        if ((response.status === 401 || response.status === 403) && isSandbox) {
            throw new Error(
                `Pinterest Sandbox Authentication Error (HTTP ${response.status}): The access token was rejected by api-sandbox.pinterest.com (${data.message || 'Unauthorized'}). ` +
                "Tokens generated in Production cannot be used in Sandbox (and vice-versa). Please reconnect your Pinterest account in the Sandbox environment or verify your sandbox credentials."
            );
        }
        throw new Error(data.message || "Failed to retrieve Pinterest user profile");
    }

    return data;
}

/**
 * Retrieve user's Pinterest boards (follows bookmark pagination until null)
 */
export async function getPinterestBoards(accessToken, env) {
    if (!accessToken) {
        throw new Error("Access token is required.");
    }

    const apiBase = getPinterestApiBase(env);
    const allBoards = [];
    let bookmark = null;

    do {
        const url = new URL(`${apiBase}/boards`);
        url.searchParams.set("page_size", "100");
        if (bookmark) {
            url.searchParams.set("bookmark", bookmark);
        }

        const response = await fetch(url.toString(), {
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
        });

        const data = await response.json();

        if (!response.ok || data.code) {
            console.error(`Failed to retrieve Pinterest boards (HTTP ${response.status}): ${data.message || "Unknown error"}`);
            const isSandbox = apiBase.includes("sandbox") || env?.PINTEREST_USE_SANDBOX === "true";
            if ((response.status === 401 || response.status === 403) && isSandbox) {
                throw new Error(
                    `Pinterest Sandbox Authentication Error (HTTP ${response.status}): The access token was rejected by api-sandbox.pinterest.com (${data.message || 'Unauthorized'}). ` +
                    "Tokens generated in Production cannot be used in Sandbox (and vice-versa). Please reconnect your Pinterest account in the Sandbox environment or verify your sandbox credentials."
                );
            }
            throw new Error(data.message || "Failed to retrieve Pinterest boards");
        }

        if (Array.isArray(data.items)) {
            allBoards.push(...data.items);
        }

        bookmark = data.bookmark || null;
    } while (bookmark);

    return allBoards;
}

/**
 * Create a new Pinterest board if needed
 */
export async function createPinterestBoard(accessToken, { name, description = "", privacy = "PUBLIC" }, env) {
    if (!accessToken) {
        throw new Error("Access token is required.");
    }

    const apiBase = getPinterestApiBase(env);
    const response = await fetch(`${apiBase}/boards`, {
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
        console.error(`Failed to create Pinterest board '${name}' (HTTP ${response.status}): ${data.message || "Unknown error"}`);
        const isSandbox = apiBase.includes("sandbox") || env?.PINTEREST_USE_SANDBOX === "true";
        if ((response.status === 401 || response.status === 403) && isSandbox) {
            throw new Error(
                `Pinterest Sandbox Authentication Error (HTTP ${response.status}): The access token was rejected by api-sandbox.pinterest.com (${data.message || 'Unauthorized'}). ` +
                "Tokens generated in Production cannot be used in Sandbox (and vice-versa). Please reconnect your Pinterest account in the Sandbox environment or verify your sandbox credentials."
            );
        }
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
    env,
}) {
    if (!accessToken) {
        throw new Error("Pinterest access token is required.");
    }

    if (!boardId) {
        throw new Error("Pinterest Board ID is required to publish a Pin.");
    }

    const apiBase = getPinterestApiBase(env);

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

    const response = await fetch(`${apiBase}/pins`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok || data.code) {
        let errorDetails = "";
        if (Array.isArray(data.details)) {
            errorDetails = data.details
                .map((d) => (typeof d === "object" ? d.message || JSON.stringify(d) : String(d)))
                .join("; ");
        } else if (typeof data.details === "string") {
            errorDetails = data.details;
        }

        const rawMsg = data.message || errorDetails || `Failed to create Pin on Pinterest (HTTP ${response.status})`;
        console.error(`Failed to create Pinterest pin (HTTP ${response.status}): ${rawMsg}`);

        const fullMsg = errorDetails && data.message && !data.message.includes(errorDetails)
            ? `${data.message} - ${errorDetails}`
            : rawMsg;

        const isSandbox = apiBase.includes("sandbox") || env?.PINTEREST_USE_SANDBOX === "true";

        if ((response.status === 401 || response.status === 403) && isSandbox) {
            const authErr = new Error(
                `Pinterest Sandbox Authentication Error (HTTP ${response.status}): The access token was rejected by api-sandbox.pinterest.com (${rawMsg}). ` +
                "Tokens generated in Production cannot be used in Sandbox (and vice-versa). Please reconnect your Pinterest account in the Sandbox environment or verify your sandbox credentials."
            );
            authErr.status = response.status;
            throw authErr;
        }

        if (!isSandbox && (/trial access/i.test(fullMsg) || (fullMsg.includes("api-sandbox.pinterest.com") && /trial/i.test(fullMsg)))) {
            const trialErr = new Error(
                "Pinterest Trial Access Restriction: Your app has Trial access, which Pinterest restricts from publishing to production (api.pinterest.com). " +
                "To fix: 1) Click 'Upgrade access' in your Pinterest Developer Dashboard to unlock Standard production access, OR " +
                "2) Add PINTEREST_USE_SANDBOX=true in backend/.dev.vars to test in the Sandbox environment."
            );
            trialErr.status = response.status;
            throw trialErr;
        }

        const err = new Error(fullMsg);
        err.status = response.status;
        throw err;
    }

    return data;
}

/**
 * Find or create a Pinterest board by name.
 * Reuses stored board ID if provided, follows bookmark pagination,
 * and creates a suffixed board once instead of generating random boards on every duplicate.
 */
export async function getOrCreateBoard(accessToken, name, env, storedBoardId = null) {
    if (storedBoardId) {
        return { id: storedBoardId, name };
    }

    const targetName = (name || "").trim().toLowerCase();

    const findMatch = async () => {
        const boards = await getPinterestBoards(accessToken, env);
        return boards.find(
            (b) => (b.name || "").trim().toLowerCase() === targetName
        );
    };

    const existing = await findMatch();
    if (existing) {
        return existing;
    }

    try {
        return await createPinterestBoard(accessToken, { name: name.trim() }, env);
    } catch (e) {
        if (/already have a board/i.test(e.message || "")) {
            const again = await findMatch();
            if (again) {
                return again;
            }
            // Create a suffixed default board once instead of random suffixes
            const suffixedName = `${name.trim()} (Default)`;
            try {
                return await createPinterestBoard(
                    accessToken,
                    { name: suffixedName },
                    env
                );
            } catch (suffErr) {
                if (/already have a board/i.test(suffErr.message || "")) {
                    const allBoards = await getPinterestBoards(accessToken, env);
                    const suffMatch = allBoards.find(
                        (b) => (b.name || "").trim().toLowerCase() === suffixedName.toLowerCase()
                    );
                    if (suffMatch) {
                        return suffMatch;
                    }
                    if (allBoards.length > 0) {
                        return allBoards[0];
                    }
                    return await createPinterestBoard(
                        accessToken,
                        { name: `${name.trim()} 1` },
                        env
                    );
                }
                throw suffErr;
            }
        }
        throw e;
    }
}
