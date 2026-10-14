const GRAPH_VERSION = "v24.0";
const FACEBOOK_GRAPH_URL = `https://graph.facebook.com/${GRAPH_VERSION}`;
const INSTAGRAM_GRAPH_URL = `https://graph.instagram.com/${GRAPH_VERSION}`;

/**
 * Determine the correct Graph API host based on token format
 * - Tokens starting with 'IGAA' use graph.instagram.com
 * - Meta User / Page tokens use graph.facebook.com
 */
function getGraphBaseUrl(token) {
    if (token && typeof token === "string" && token.startsWith("IGAA")) {
        return INSTAGRAM_GRAPH_URL;
    }
    return FACEBOOK_GRAPH_URL;
}

/**
 * Exchange OAuth authorization code for User Access Token
 */
export async function exchangeInstagramCodeForUserToken(code, redirectUri, env) {
    const appId = env.INSTAGRAM_APP_ID || env.FACEBOOK_APP_ID;
    const appSecret = env.INSTAGRAM_APP_SECRET || env.FACEBOOK_APP_SECRET;

    if (!appId || !appSecret) {
        throw new Error("Meta/Instagram App ID and Secret are not configured in backend environment.");
    }

    // Attempt 1: Direct Instagram OAuth token exchange (api.instagram.com)
    try {
        const formData = new FormData();
        formData.append("client_id", appId);
        formData.append("client_secret", appSecret);
        formData.append("grant_type", "authorization_code");
        formData.append("redirect_uri", redirectUri);
        formData.append("code", code);

        const igResp = await fetch("https://api.instagram.com/oauth/access_token", {
            method: "POST",
            body: formData,
        });
        const igData = await igResp.json();
        if (igResp.ok && igData.access_token) {
            return igData;
        }
    } catch (e) {
        console.warn("Direct Instagram token exchange fallback to Graph API:", e);
    }

    // Attempt 2: Facebook Graph API token exchange
    const url = new URL(`${FACEBOOK_GRAPH_URL}/oauth/access_token`);
    url.searchParams.set("client_id", appId);
    url.searchParams.set("client_secret", appSecret);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("code", code);

    const response = await fetch(url.toString());
    const data = await response.json();

    if (!response.ok || data.error) {
        throw new Error(
            data.error?.message || "Failed to exchange authorization code for access token."
        );
    }

    return data;
}

/**
 * Discover Instagram Business/Creator accounts
 * Supports both graph.instagram.com (IGAA tokens) and graph.facebook.com (/me/accounts)
 */
export async function getInstagramBusinessAccounts(userAccessToken) {
    if (!userAccessToken) {
        throw new Error("Access token is required.");
    }

    // Handle Instagram User token (IGAA...)
    if (userAccessToken.startsWith("IGAA")) {
        const url = new URL(`${INSTAGRAM_GRAPH_URL}/me`);
        url.searchParams.set("fields", "id,username,account_type");
        url.searchParams.set("access_token", userAccessToken);

        const response = await fetch(url.toString());
        const data = await response.json();

        if (!response.ok || data.error) {
            throw new Error(
                data.error?.message || "Failed to retrieve Instagram account via graph.instagram.com"
            );
        }

        return [{
            instagram_business_id: data.id,
            username: data.username || "instagram_user",
            name: data.username || "Instagram Account",
            profile_picture_url: null,
            page_id: null,
            page_name: data.username,
            access_token: userAccessToken,
        }];
    }

    // Handle Meta Graph API (Facebook Page linked accounts)
    const url = new URL(`${FACEBOOK_GRAPH_URL}/me/accounts`);
    url.searchParams.set(
        "fields",
        "id,name,access_token,category,instagram_business_account{id,username,name,profile_picture_url}"
    );
    url.searchParams.set("access_token", userAccessToken);

    const response = await fetch(url.toString());
    const data = await response.json();

    if (!response.ok || data.error) {
        throw new Error(
            data.error?.message || "Failed to fetch Facebook pages and linked Instagram accounts."
        );
    }

    const pages = data.data || [];
    const instagramAccounts = [];

    for (const page of pages) {
        if (page.instagram_business_account) {
            const ig = page.instagram_business_account;
            instagramAccounts.push({
                instagram_business_id: ig.id,
                username: ig.username || "instagram_user",
                name: ig.name || page.name,
                profile_picture_url: ig.profile_picture_url || null,
                page_id: page.id,
                page_name: page.name,
                access_token: page.access_token || userAccessToken,
            });
        }
    }

    return instagramAccounts;
}

/**
 * Fetch Instagram Business Account details directly by ID
 */
export async function getInstagramAccountDetails(instagramBusinessId, accessToken) {
    const baseUrl = getGraphBaseUrl(accessToken);
    const target = (accessToken?.startsWith("IGAA") && (!instagramBusinessId || instagramBusinessId === "me"))
        ? "me"
        : instagramBusinessId;

    const url = new URL(`${baseUrl}/${target}`);
    url.searchParams.set("fields", "id,username,name,profile_picture_url,account_type");
    url.searchParams.set("access_token", accessToken);

    const response = await fetch(url.toString());
    const data = await response.json();

    if (!response.ok || data.error) {
        throw new Error(
            data.error?.message || `Failed to fetch Instagram account details for ID ${instagramBusinessId}`
        );
    }

    return data;
}

/**
 * Step 1: Create an Instagram Media Container
 * @param {string} instagramBusinessId
 * @param {string} accessToken
 * @param {string} imageUrl - Publicly accessible URL for the image
 * @param {string} caption - Post caption
 */
export async function createInstagramMediaContainer({
    instagramBusinessId,
    accessToken,
    imageUrl,
    caption = "",
}) {
    if (!imageUrl) {
        throw new Error("Instagram requires a publicly accessible image URL. Pure text posts are not supported on Instagram.");
    }

    const baseUrl = getGraphBaseUrl(accessToken);
    const url = new URL(`${baseUrl}/${instagramBusinessId}/media`);
    url.searchParams.set("image_url", imageUrl);
    if (caption) {
        url.searchParams.set("caption", caption);
    }
    url.searchParams.set("access_token", accessToken);

    const response = await fetch(url.toString(), {
        method: "POST",
    });

    const data = await response.json();

    if (!response.ok || data.error) {
        throw new Error(
            data.error?.message || "Failed to create Instagram media container."
        );
    }

    return data; // { id: "container_id" }
}

/**
 * Step 2: Check status of an Instagram Media Container
 */
export async function checkInstagramContainerStatus(containerId, accessToken) {
    const baseUrl = getGraphBaseUrl(accessToken);
    const url = new URL(`${baseUrl}/${containerId}`);
    url.searchParams.set("fields", "status_code,status");
    url.searchParams.set("access_token", accessToken);

    const response = await fetch(url.toString());
    const data = await response.json();

    if (!response.ok || data.error) {
        throw new Error(
            data.error?.message || "Failed to check Instagram media status."
        );
    }

    return data; // { status_code: "FINISHED" | "IN_PROGRESS" | "ERROR" | "EXPIRED" }
}

/**
 * Step 3: Publish the created container to Instagram feed
 */
export async function publishInstagramMedia({
    instagramBusinessId,
    creationId,
    accessToken,
}) {
    const baseUrl = getGraphBaseUrl(accessToken);
    const url = new URL(`${baseUrl}/${instagramBusinessId}/media_publish`);
    url.searchParams.set("creation_id", creationId);
    url.searchParams.set("access_token", accessToken);

    const response = await fetch(url.toString(), {
        method: "POST",
    });

    const data = await response.json();

    if (!response.ok || data.error) {
        throw new Error(
            data.error?.message || "Failed to publish Instagram media container."
        );
    }

    return data; // { id: "instagram_post_id" }
}

/**
 * Complete Instagram photo publishing workflow:
 * 1. Create container
 * 2. Poll status until FINISHED
 * 3. Publish container
 */
export async function publishInstagramPhotoPost({
    instagramBusinessId,
    accessToken,
    imageUrl,
    caption = "",
}) {
    // 1. Create Media Container
    const containerResult = await createInstagramMediaContainer({
        instagramBusinessId,
        accessToken,
        imageUrl,
        caption,
    });

    const containerId = containerResult.id;
    if (!containerId) {
        throw new Error("Did not receive a container ID from Instagram API.");
    }

    // 2. Poll status (single image is usually FINISHED within 1-3s, retry if IN_PROGRESS)
    let isReady = false;
    let attempts = 0;
    const maxAttempts = 15;

    while (!isReady && attempts < maxAttempts) {
        attempts++;
        const statusData = await checkInstagramContainerStatus(containerId, accessToken);
        const code = statusData.status_code;

        if (code === "FINISHED") {
            isReady = true;
            break;
        } else if (code === "ERROR") {
            throw new Error(
                statusData.status || "Instagram media container processing failed."
            );
        } else if (code === "EXPIRED") {
            throw new Error("Instagram media container expired before it could be published.");
        } else {
            // IN_PROGRESS: wait 1.5 seconds and retry
            await new Promise((resolve) => setTimeout(resolve, 1500));
        }
    }

    if (!isReady) {
        throw new Error("Instagram media processing timed out. Please try again.");
    }

    // 3. Publish container
    const publishResult = await publishInstagramMedia({
        instagramBusinessId,
        creationId: containerId,
        accessToken,
    });

    return {
        id: publishResult.id,
        containerId: containerId,
    };
}
