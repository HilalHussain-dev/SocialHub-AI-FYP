/**
 * LinkedIn API v2 Service Layer for SocialHub AI
 * Handles OAuth 2.0, profile retrieval, and content publishing
 */

const LINKEDIN_API_BASE = "https://api.linkedin.com/v2";
const LINKEDIN_API_REST = "https://api.linkedin.com/rest";

/**
 * Exchange LinkedIn authorization code for Access Token
 */
export async function exchangeLinkedInCodeForToken(code, redirectUri, env) {
    const clientId = env?.LINKEDIN_CLIENT_ID;
    const clientSecret = env?.LINKEDIN_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        throw new Error("LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET must be configured in backend environment.");
    }

    const tokenUrl = "https://www.linkedin.com/oauth/v2/accessToken";
    
    const params = new URLSearchParams();
    params.set("grant_type", "authorization_code");
    params.set("code", code);
    params.set("redirect_uri", redirectUri);
    params.set("client_id", clientId);
    params.set("client_secret", clientSecret);

    const response = await fetch(tokenUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
    });

    const data = await response.json();

    if (!response.ok || data.error) {
        const errorMsg = data.error_description || data.error || "Failed to exchange authorization code for LinkedIn access token";
        console.error(`LinkedIn code exchange failed (HTTP ${response.status}): ${errorMsg}`);
        throw new Error(errorMsg);
    }

    return data;
}

/**
 * Get authenticated user's LinkedIn profile (using OpenID Connect userinfo endpoint)
 */
export async function getLinkedInUserProfile(accessToken) {
    if (!accessToken) {
        throw new Error("Access token is required.");
    }

    // Use OpenID Connect userinfo endpoint which doesn't require versioning
    const response = await fetch("https://api.linkedin.com/v2/userinfo", {
        headers: {
            "Authorization": `Bearer ${accessToken}`,
        },
    });

    const data = await response.json();

    if (!response.ok) {
        console.error(`Failed to retrieve LinkedIn user profile (HTTP ${response.status}):`, data);
        throw new Error(data.message || "Failed to retrieve LinkedIn user profile");
    }

    return data;
}

/**
 * Get user's profile picture URL
 */
export async function getLinkedInProfilePicture(accessToken, profileId) {
    if (!accessToken || !profileId) {
        return null;
    }

    try {
        const response = await fetch(
            `${LINKEDIN_API_BASE}/me?projection=(id,profilePicture(displayImage~:playableStreams))`,
            {
                headers: {
                    "Authorization": `Bearer ${accessToken}`,
                },
            }
        );

        if (!response.ok) {
            return null;
        }

        const data = await response.json();
        const elements = data?.profilePicture?.["displayImage~"]?.elements;
        
        if (elements && elements.length > 0) {
            // Get the largest image
            const largest = elements.reduce((prev, curr) => {
                const prevSize = (prev.data?.["com.linkedin.digitalmedia.mediaartifact.StillImage"]?.displaySize?.width || 0);
                const currSize = (curr.data?.["com.linkedin.digitalmedia.mediaartifact.StillImage"]?.displaySize?.width || 0);
                return currSize > prevSize ? curr : prev;
            });
            
            const identifiers = largest.identifiers;
            if (identifiers && identifiers.length > 0) {
                return identifiers[0].identifier;
            }
        }
    } catch (err) {
        console.warn("Could not fetch LinkedIn profile picture:", err.message);
    }

    return null;
}

/**
 * Helper to convert ArrayBuffer to Base64
 */
function arrayBufferToBase64(buffer) {
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
 * Upload an image to LinkedIn and get the asset URN
 * Uses the standard v2 API (not REST API with versioning)
 */
async function uploadImageToLinkedIn(accessToken, profileUrn, imageData) {
    // Step 1: Register the upload using v2 API
    const registerResponse = await fetch("https://api.linkedin.com/v2/assets?action=registerUpload", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            registerUploadRequest: {
                recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
                owner: profileUrn,
                serviceRelationships: [
                    {
                        relationshipType: "OWNER",
                        identifier: "urn:li:userGeneratedContent"
                    }
                ]
            }
        }),
    });

    if (!registerResponse.ok) {
        const error = await registerResponse.json().catch(() => ({}));
        console.error("LinkedIn image registration failed:", error);
        throw new Error(error.message || "Failed to register image upload with LinkedIn");
    }

    const registerData = await registerResponse.json();
    const uploadUrl = registerData.value?.uploadMechanism?.["com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"]?.uploadUrl;
    const asset = registerData.value?.asset;

    if (!uploadUrl || !asset) {
        throw new Error("LinkedIn did not return upload URL or asset URN");
    }

    // Step 2: Upload the binary image data
    let imageBlob;
    if (imageData instanceof Blob || imageData instanceof File) {
        imageBlob = imageData;
    } else if (typeof imageData === 'string') {
        // Base64 string
        const cleanBase64 = imageData.replace(/^data:[^;]+;base64,/, "");
        const binaryString = atob(cleanBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        imageBlob = new Blob([bytes], { type: "image/jpeg" });
    } else if (imageData instanceof ArrayBuffer) {
        imageBlob = new Blob([imageData], { type: "image/jpeg" });
    } else {
        throw new Error("Unsupported image data format");
    }

    const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
            "Authorization": `Bearer ${accessToken}`,
        },
        body: imageBlob,
    });

    if (!uploadResponse.ok) {
        throw new Error(`Failed to upload image binary (HTTP ${uploadResponse.status})`);
    }

    return asset;
}

/**
 * Publish a text post to LinkedIn
 */
export async function publishLinkedInTextPost(accessToken, profileUrn, text) {
    if (!accessToken || !profileUrn) {
        throw new Error("Access token and profile URN are required");
    }

    if (!text || !text.trim()) {
        throw new Error("Post text is required");
    }

    const payload = {
        author: profileUrn,
        lifecycleState: "PUBLISHED",
        specificContent: {
            "com.linkedin.ugc.ShareContent": {
                shareCommentary: {
                    text: text.trim(),
                },
                shareMediaCategory: "NONE",
            },
        },
        visibility: {
            "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
        },
    };

    const response = await fetch(`${LINKEDIN_API_BASE}/ugcPosts`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            "X-RestLi-Protocol-Version": "2.0.0",
        },
        body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        console.error(`LinkedIn text post failed (HTTP ${response.status}):`, data);
        throw new Error(data.message || `Failed to publish LinkedIn text post (HTTP ${response.status})`);
    }

    return {
        id: data.id,
        success: true,
    };
}

/**
 * Publish an image post to LinkedIn
 */
export async function publishLinkedInImagePost({
    accessToken,
    profileUrn,
    text = "",
    imageFile = null,
    imageBase64 = null,
}) {
    if (!accessToken || !profileUrn) {
        throw new Error("Access token and profile URN are required");
    }

    if (!imageFile && !imageBase64) {
        throw new Error("An image is required for LinkedIn image post");
    }

    // Upload the image first
    const imageData = imageFile || imageBase64;
    const imageUrn = await uploadImageToLinkedIn(accessToken, profileUrn, imageData);

    // Create the post with the uploaded image
    const payload = {
        author: profileUrn,
        lifecycleState: "PUBLISHED",
        specificContent: {
            "com.linkedin.ugc.ShareContent": {
                shareCommentary: {
                    text: text.trim() || "",
                },
                shareMediaCategory: "IMAGE",
                media: [
                    {
                        status: "READY",
                        media: imageUrn,
                    },
                ],
            },
        },
        visibility: {
            "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
        },
    };

    const response = await fetch(`${LINKEDIN_API_BASE}/ugcPosts`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            "X-RestLi-Protocol-Version": "2.0.0",
        },
        body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        console.error(`LinkedIn image post failed (HTTP ${response.status}):`, data);
        throw new Error(data.message || `Failed to publish LinkedIn image post (HTTP ${response.status})`);
    }

    return {
        id: data.id,
        success: true,
    };
}
