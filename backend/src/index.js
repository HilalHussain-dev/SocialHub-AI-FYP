import {
	facebookAuth,
	facebookCallback,
	selectFacebookPage,
	activateFacebookPage,
	getFacebookPagesForUser,
	handleFacebookPost,
	handleGetPosts,
} from "./routes/facebook.js";
import {
	instagramAuth,
	instagramCallback,
	selectInstagramAccount,
	activateInstagramAccount,
	getInstagramAccountsForUser,
	syncInstagramDirectToken,
	handleInstagramPost,
} from "./routes/instagram.js";
import {
    handleRegister,
    handleLogin,
    handleMe,
    handleLogout
} from "./routes/auth.js";
import { handleOptions, withCors } from "./utils/cors.js";

export default {
	async fetch(request, env, ctx) {
		const url = new URL(request.url);

		if (request.method === "OPTIONS") {
			return handleOptions(request);
		}

		// Auth Routes
		if (request.method === "POST" && url.pathname === "/api/auth/register") {
			return handleRegister(request, env);
		}
		if (request.method === "POST" && url.pathname === "/api/auth/login") {
			return handleLogin(request, env);
		}
		if (request.method === "POST" && url.pathname === "/api/auth/logout") {
			return handleLogout(request, env);
		}
		if (request.method === "GET" && url.pathname === "/api/auth/me") {
			return handleMe(request, env);
		}

		// Facebook OAuth Start
		if (
			request.method === "GET" &&
			(url.pathname === "/api/facebook/auth" || url.pathname === "/api/auth/facebook/connect" || url.pathname === "/api/auth/facebook")
		) {
			return await facebookAuth(request, env);
		}

		// Facebook OAuth callback from Facebook redirect
		if (
			request.method === "GET" &&
			(url.pathname === "/api/facebook/callback" || url.pathname === "/api/auth/facebook/callback")
		) {
			return await facebookCallback(request, env);
		}

		// Get connected Facebook Pages
		if (
			request.method === "GET" &&
			(url.pathname === "/api/facebook/pages" || url.pathname === "/api/auth/facebook/pages")
		) {
			return await getFacebookPagesForUser(request, env);
		}

		// Post to Facebook
		if (
			request.method === "POST" &&
			(url.pathname === "/api/facebook/post" || url.pathname === "/api/auth/facebook/post")
		) {
			return await handleFacebookPost(request, env);
		}

		// Select Facebook Page (after OAuth picker)
		if (
			request.method === "POST" &&
			url.pathname === "/api/facebook/pages/select"
		) {
			return await selectFacebookPage(request, env);
		}

		// Activate / Switch Facebook Page
		if (
			request.method === "POST" &&
			url.pathname === "/api/facebook/pages/activate"
		) {
			return await activateFacebookPage(request, env);
		}

		// Instagram OAuth Start
		if (
			request.method === "GET" &&
			(url.pathname === "/api/instagram/auth" || url.pathname === "/api/auth/instagram/connect" || url.pathname === "/api/auth/instagram")
		) {
			return await instagramAuth(request, env);
		}

		// Instagram OAuth callback from Meta redirect
		if (
			request.method === "GET" &&
			(url.pathname === "/api/instagram/callback" || url.pathname === "/api/auth/instagram/callback")
		) {
			return await instagramCallback(request, env);
		}

		// Get connected Instagram Business accounts
		if (
			request.method === "GET" &&
			(url.pathname === "/api/instagram/accounts" || url.pathname === "/api/auth/instagram/accounts")
		) {
			return await getInstagramAccountsForUser(request, env);
		}

		// Connect / Sync Instagram account directly via Access Token
		if (
			request.method === "POST" &&
			(url.pathname === "/api/instagram/sync-token" || url.pathname === "/api/instagram/connect-direct" || url.pathname === "/api/auth/instagram/sync-token")
		) {
			return await syncInstagramDirectToken(request, env);
		}

		// Post to Instagram
		if (
			request.method === "POST" &&
			(url.pathname === "/api/instagram/post" || url.pathname === "/api/auth/instagram/post")
		) {
			return await handleInstagramPost(request, env);
		}

		// Select Instagram Account (after OAuth picker)
		if (
			request.method === "POST" &&
			url.pathname === "/api/instagram/accounts/select"
		) {
			return await selectInstagramAccount(request, env);
		}

		// Activate / Switch Instagram Account
		if (
			request.method === "POST" &&
			url.pathname === "/api/instagram/accounts/activate"
		) {
			return await activateInstagramAccount(request, env);
		}



		// Get Post History from D1 database
		if (
			request.method === "GET" &&
			url.pathname === "/api/posts"
		) {
			return await handleGetPosts(request, env);
		}

		// Serve Media from Cloudflare R2 bucket (socialhub-media)
		if (
			request.method === "GET" &&
			url.pathname.startsWith("/api/media/")
		) {
			const key = decodeURIComponent(url.pathname.replace(/^\/api\/media\//, ""));
			if (!env.socialhub_media) {
				return withCors(new Response("R2 storage not configured", { status: 500 }), request);
			}
			const object = await env.socialhub_media.get(key);
			if (!object) {
				return withCors(new Response("Media not found", { status: 404 }), request);
			}
			const headers = new Headers();
			object.writeHttpMetadata(headers);
			headers.set("etag", object.httpEtag);
			headers.set("Cache-Control", "public, max-age=31536000, immutable");
			return withCors(new Response(object.body, { headers }), request);
		}

		// Health check
		if (
			request.method === "GET" &&
			url.pathname === "/api/health"
		) {
			return withCors(Response.json({
				success: true,
				service: "SocialHub AI Backend",
				status: "running",
			}), request);
		}

		return withCors(new Response("Not Found", {
			status: 404,
		}), request);
	},
};