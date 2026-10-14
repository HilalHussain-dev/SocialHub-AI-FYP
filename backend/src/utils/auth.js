export async function hashPassword(password, saltString = null) {
    const encoder = new TextEncoder();
    const salt = saltString 
        ? Uint8Array.from(atob(saltString), c => c.charCodeAt(0)) 
        : crypto.getRandomValues(new Uint8Array(16));
    
    const keyMaterial = await crypto.subtle.importKey(
        "raw",
        encoder.encode(password),
        { name: "PBKDF2" },
        false,
        ["deriveBits", "deriveKey"]
    );
    
    const key = await crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: salt,
            iterations: 100000,
            hash: "SHA-256"
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
    );
    
    const exportedKey = await crypto.subtle.exportKey("raw", key);
    const hashBuffer = new Uint8Array(exportedKey);
    const hashBase64 = btoa(String.fromCharCode(...hashBuffer));
    const saltBase64 = btoa(String.fromCharCode(...salt));
    
    return `${saltBase64}:${hashBase64}`;
}

export async function verifyPassword(password, storedHash) {
    const [saltBase64, hashBase64] = storedHash.split(':');
    const newHash = await hashPassword(password, saltBase64);
    return newHash === storedHash;
}

export function createSessionCookie(token, expiresAt) {
    const maxAge = Math.floor((expiresAt.getTime() - Date.now()) / 1000);
    return `session_token=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}

export function getSessionCookie(request) {
    const cookieHeader = request.headers.get("Cookie") || "";
    const cookies = cookieHeader.split(";").map((cookie) => cookie.trim());
    for (const cookie of cookies) {
        const [key, ...valueParts] = cookie.split("=");
        if (key === "session_token") {
            return decodeURIComponent(valueParts.join("="));
        }
    }
    return null;
}
