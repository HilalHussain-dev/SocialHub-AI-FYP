import { hashPassword, verifyPassword, createSessionCookie, getSessionCookie } from "../utils/auth.js";
import { withCors } from "../utils/cors.js";

async function parseBody(request) {
    try {
        return await request.json();
    } catch {
        return {};
    }
}

export async function handleRegister(request, env) {
    const { email, password } = await parseBody(request);
    if (!email || !password) {
        return withCors(new Response(JSON.stringify({ error: "Email and password are required" }), { status: 400, headers: { "Content-Type": "application/json" } }));
    }

    // Check if user exists
    const existingUser = await env.socialhub_db.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
    if (existingUser) {
        return withCors(new Response(JSON.stringify({ error: "An account with this email already exists." }), { status: 400, headers: { "Content-Type": "application/json" } }));
    }

    const userId = crypto.randomUUID();

    await env.socialhub_db.prepare(
        "INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)"
    ).bind(userId, email, password).run();

    // Create session
    const sessionToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await env.socialhub_db.prepare(
        "INSERT INTO sessions (id, user_id, session_token, expires_at) VALUES (?, ?, ?, ?)"
    ).bind(crypto.randomUUID(), userId, sessionToken, expiresAt.toISOString()).run();

    const response = new Response(JSON.stringify({ success: true, user: { id: userId, email } }), {
        status: 201,
        headers: {
            "Content-Type": "application/json",
            "Set-Cookie": createSessionCookie(sessionToken, expiresAt)
        }
    });

    return withCors(response);
}

export async function handleLogin(request, env) {
    const { email, password } = await parseBody(request);
    if (!email || !password) {
        return withCors(new Response(JSON.stringify({ error: "Email and password are required" }), { status: 400, headers: { "Content-Type": "application/json" } }));
    }

    const user = await env.socialhub_db.prepare("SELECT id, email, password_hash FROM users WHERE email = ?").bind(email).first();
    if (!user) {
        return withCors(new Response(JSON.stringify({ error: "Invalid email or password." }), { status: 401, headers: { "Content-Type": "application/json" } }));
    }

    let isValid = password === user.password_hash;
    if (!isValid && user.password_hash && user.password_hash.includes(':')) {
        try {
            isValid = await verifyPassword(password, user.password_hash);
        } catch (e) {
            console.error("Password verification error:", e);
        }
    }

    if (!isValid) {
        return withCors(new Response(JSON.stringify({ error: "Invalid email or password." }), { status: 401, headers: { "Content-Type": "application/json" } }));
    }

    await env.socialhub_db.prepare("UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?").bind(user.id).run();

    const sessionToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await env.socialhub_db.prepare(
        "INSERT INTO sessions (id, user_id, session_token, expires_at) VALUES (?, ?, ?, ?)"
    ).bind(crypto.randomUUID(), user.id, sessionToken, expiresAt.toISOString()).run();

    const response = new Response(JSON.stringify({ success: true, user: { id: user.id, email: user.email } }), {
        status: 200,
        headers: {
            "Content-Type": "application/json",
            "Set-Cookie": createSessionCookie(sessionToken, expiresAt)
        }
    });

    return withCors(response);
}

export async function handleMe(request, env) {
    const token = getSessionCookie(request);
    if (!token) {
        return withCors(new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } }));
    }

    const session = await env.socialhub_db.prepare(
        "SELECT user_id, expires_at FROM sessions WHERE session_token = ?"
    ).bind(token).first();

    if (!session || new Date(session.expires_at) < new Date()) {
        return withCors(new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } }));
    }

    const user = await env.socialhub_db.prepare("SELECT id, email, name FROM users WHERE id = ?").bind(session.user_id).first();

    if (!user) {
        return withCors(new Response(JSON.stringify({ error: "User not found" }), { status: 404, headers: { "Content-Type": "application/json" } }));
    }

    return withCors(new Response(JSON.stringify({ user }), { status: 200, headers: { "Content-Type": "application/json" } }));
}

export async function handleLogout(request, env) {
    const token = getSessionCookie(request);
    if (token) {
        await env.socialhub_db.prepare("DELETE FROM sessions WHERE session_token = ?").bind(token).run();
    }

    const response = new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: {
            "Content-Type": "application/json",
            "Set-Cookie": "session_token=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0"
        }
    });

    return withCors(response);
}
