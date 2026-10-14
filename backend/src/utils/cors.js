export function getCorsHeaders(request) {
    const origin = request?.headers?.get("Origin") || "http://localhost:8443";
    return {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Credentials": "true",
    };
}

export function handleOptions(request) {
    return new Response(null, {
        status: 204,
        headers: getCorsHeaders(request)
    });
}

export function withCors(response, request = null) {
    const headers = getCorsHeaders(request);
    const newHeaders = new Headers(response.headers);
    for (const [key, value] of Object.entries(headers)) {
        newHeaders.set(key, value);
    }
    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders
    });
}
