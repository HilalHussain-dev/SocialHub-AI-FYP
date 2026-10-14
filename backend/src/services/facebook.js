const FACEBOOK_GRAPH_VERSION = "v24.0";
const FACEBOOK_GRAPH_URL = `https://graph.facebook.com/${FACEBOOK_GRAPH_VERSION}`;

export async function exchangeCodeForUserToken(code, redirectUri, env) {
    const url = new URL(`${FACEBOOK_GRAPH_URL}/oauth/access_token`);

    url.searchParams.set("client_id", env.FACEBOOK_APP_ID);
    url.searchParams.set("client_secret", env.FACEBOOK_APP_SECRET);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("code", code);

    const response = await fetch(url.toString());
    const data = await response.json();

    if (!response.ok || data.error) {
        throw new Error(
            data.error?.message || "Failed to exchange Facebook authorization code"
        );
    }

    return data;
}

export async function getFacebookPages(userAccessToken) {
    const url = new URL(`${FACEBOOK_GRAPH_URL}/me/accounts`);

    url.searchParams.set("fields", "id,name,access_token,category,instagram_business_account{id,username,name,profile_picture_url}");
    url.searchParams.set("access_token", userAccessToken);

    const response = await fetch(url.toString());
    const data = await response.json();

    if (!response.ok || data.error) {
        throw new Error(
            data.error?.message || "Failed to retrieve Facebook Pages"
        );
    }

    return data.data || [];
}

export async function publishFacebookTextPost(
    pageId,
    pageAccessToken,
    message
) {
    const url = `${FACEBOOK_GRAPH_URL}/${pageId}/feed`;

    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            message,
            access_token: pageAccessToken,
        }),
    });

    const data = await response.json();

    if (!response.ok || data.error) {
        throw new Error(
            data.error?.message || "Failed to publish Facebook post"
        );
    }

    return data;
}

/**
 * Publish photo/media post to Facebook Page feed
 * Accepts either imageFile (Blob/File) or imageUrl
 */
export async function publishFacebookPhotoPost({
    pageId,
    pageAccessToken,
    caption = "",
    imageFile = null,
    imageUrl = null,
}) {
    const url = `${FACEBOOK_GRAPH_URL}/${pageId}/photos`;
    const formData = new FormData();

    formData.append("access_token", pageAccessToken);
    if (caption) {
        formData.append("caption", caption);
    }

    if (imageFile) {
        formData.append("source", imageFile);
    } else if (imageUrl) {
        formData.append("url", imageUrl);
    } else {
        throw new Error("An image file or image URL is required for a photo post.");
    }

    const response = await fetch(url, {
        method: "POST",
        body: formData,
    });

    const data = await response.json();

    if (!response.ok || data.error) {
        throw new Error(
            data.error?.message || "Failed to publish Facebook photo post"
        );
    }

    return data;
}