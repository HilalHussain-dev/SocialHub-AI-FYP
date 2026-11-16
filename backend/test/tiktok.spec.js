import { describe, it, expect, vi, beforeEach } from "vitest";
import {
    getTikTokApiBase,
    getTikTokAuthBase,
    generateCodeVerifier,
    generateCodeChallenge,
    buildTikTokAuthUrl,
    exchangeTikTokCodeForToken,
    refreshTikTokToken,
    revokeTikTokToken,
    getTikTokUserProfile,
    initVideoPublish,
    uploadVideoChunk,
    checkPublishStatus,
    fetchPublishStatus,
    mapTikTokStatus,
    TIKTOK_SCOPES,
} from "../src/services/tiktok.js";
import {
    ensureTikTokTable,
    tiktokAuth,
    tiktokCallback,
    getTikTokAccountsForUser,
    activateTikTokAccount,
    disconnectTikTokAccount,
    handleTikTokPost,
    handleTikTokStatus,
    handleTikTokRefreshStatus,
} from "../src/routes/tiktok.js";

describe("TikTok Service & Routes", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    describe("TikTok Service Helpers", () => {
        it("returns default API base and respects custom base", () => {
            expect(getTikTokApiBase({})).toBe("https://open.tiktokapis.com/v2");
            expect(getTikTokApiBase({ TIKTOK_API_BASE: "https://sandbox.tiktokapis.com/v2/" })).toBe("https://sandbox.tiktokapis.com/v2");
        });

        it("generates PKCE code verifier and S256 challenge", async () => {
            const verifier = generateCodeVerifier();
            expect(typeof verifier).toBe("string");
            expect(verifier.length).toBeGreaterThanOrEqual(43);

            const challenge = await generateCodeChallenge(verifier);
            expect(typeof challenge).toBe("string");
            expect(challenge.length).toBeGreaterThan(0);
            expect(challenge).not.toContain("+");
            expect(challenge).not.toContain("/");
            expect(challenge).not.toContain("=");
        });

        it("builds TikTok OAuth authorization URL for standard Web (without PKCE) and with PKCE", async () => {
            // Standard Web flow: no code_challenge to prevent bytedance:// bridge errors on web
            const webAuth = await buildTikTokAuthUrl({
                clientKey: "test_client_key",
                redirectUri: "http://localhost:8787/api/tiktok/callback",
                state: "state123",
                scopes: ["user.info.basic", "video.publish", "video.upload"],
                env: {},
                enablePkce: false,
            });

            const webParsed = new URL(webAuth.url);
            expect(webParsed.searchParams.get("client_key")).toBe("test_client_key");
            expect(webParsed.searchParams.get("response_type")).toBe("code");
            expect(webParsed.searchParams.get("scope")).toBe("user.info.basic,video.publish,video.upload");
            expect(webParsed.searchParams.get("redirect_uri")).toBe("http://localhost:8787/api/tiktok/callback");
            expect(webParsed.searchParams.get("code_challenge")).toBeNull();
            expect(webParsed.searchParams.get("code_challenge_method")).toBeNull();

            // PKCE flow when explicitly enabled
            const pkceAuth = await buildTikTokAuthUrl({
                clientKey: "test_client_key",
                redirectUri: "http://localhost:8787/api/tiktok/callback",
                state: "state123",
                scopes: ["user.info.basic", "video.publish", "video.upload"],
                env: {},
                enablePkce: true,
            });

            const pkceParsed = new URL(pkceAuth.url);
            expect(pkceParsed.searchParams.get("code_challenge_method")).toBe("S256");
            expect(pkceParsed.searchParams.get("code_challenge")).toBeTruthy();
            expect(pkceAuth.codeVerifier).toBeTruthy();
        });
    });

    describe("exchangeTikTokCodeForToken", () => {
        it("throws if credentials are missing", async () => {
            await expect(
                exchangeTikTokCodeForToken("code123", "http://redirect", {})
            ).rejects.toThrow(/TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET/);
        });

        it("exchanges code for access token successfully", async () => {
            const mockFetch = vi.fn().mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    data: {
                        access_token: "act.test_token_123",
                        expires_in: 86400,
                        open_id: "open_id_123",
                        refresh_token: "rft.refresh_token_123",
                        refresh_expires_in: 31536000,
                        scope: "user.info.basic,video.publish,video.upload",
                    },
                    error: { code: "ok", message: "" },
                }),
            });
            globalThis.fetch = mockFetch;

            const res = await exchangeTikTokCodeForToken("valid_code", "http://localhost/callback", {
                TIKTOK_CLIENT_KEY: "my_key",
                TIKTOK_CLIENT_SECRET: "my_secret",
            }, "my_verifier");

            expect(res.access_token).toBe("act.test_token_123");
            expect(res.open_id).toBe("open_id_123");
            expect(mockFetch).toHaveBeenCalledTimes(1);
            expect(mockFetch.mock.calls[0][1].body).toContain("client_key=my_key");
            expect(mockFetch.mock.calls[0][1].body).toContain("code_verifier=my_verifier");
        });

        it("handles error response from TikTok token endpoint", async () => {
            globalThis.fetch = vi.fn().mockResolvedValueOnce({
                ok: false,
                status: 400,
                json: async () => ({
                    error: {
                        code: "invalid_grant",
                        message: "Authorization code has expired",
                    },
                }),
            });

            await expect(
                exchangeTikTokCodeForToken("expired_code", "http://redirect", {
                    TIKTOK_CLIENT_KEY: "my_key",
                    TIKTOK_CLIENT_SECRET: "my_secret",
                })
            ).rejects.toThrow(/Authorization code has expired/);
        });
    });

    describe("refreshTikTokToken & revokeTikTokToken", () => {
        it("refreshes token successfully", async () => {
            globalThis.fetch = vi.fn().mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    data: {
                        access_token: "act.new_token_456",
                        refresh_token: "rft.new_refresh_456",
                        expires_in: 86400,
                    },
                    error: { code: "ok" },
                }),
            });

            const res = await refreshTikTokToken("old_refresh", {
                TIKTOK_CLIENT_KEY: "my_key",
                TIKTOK_CLIENT_SECRET: "my_secret",
            });

            expect(res.access_token).toBe("act.new_token_456");
        });

        it("revokes token gracefully", async () => {
            globalThis.fetch = vi.fn().mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({}),
            });

            const res = await revokeTikTokToken("token_to_revoke", {
                TIKTOK_CLIENT_KEY: "my_key",
                TIKTOK_CLIENT_SECRET: "my_secret",
            });

            expect(res.success).toBe(true);
        });
    });

    describe("getTikTokUserProfile", () => {
        it("fetches and parses user profile correctly", async () => {
            globalThis.fetch = vi.fn().mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    data: {
                        user: {
                            open_id: "open_id_user_1",
                            union_id: "union_id_user_1",
                            username: "creator_test",
                            display_name: "Test Creator",
                            avatar_large_url: "https://p16.tiktokcdn.com/avatar.jpg",
                            bio_description: "Hello TikTok!",
                            is_verified: true,
                        },
                    },
                    error: { code: "ok" },
                }),
            });

            const profile = await getTikTokUserProfile("valid_access_token", {});
            expect(profile.open_id).toBe("open_id_user_1");
            expect(profile.username).toBe("creator_test");
            expect(profile.display_name).toBe("Test Creator");
            expect(profile.avatar_url).toBe("https://p16.tiktokcdn.com/avatar.jpg");
            expect(profile.is_verified).toBe(true);
        });
    });

    describe("initVideoPublish & uploadVideoChunk & checkPublishStatus", () => {
        it("initializes direct post publish", async () => {
            globalThis.fetch = vi.fn().mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    data: {
                        publish_id: "v_pub_direct_123",
                        upload_url: "https://open-upload.tiktokapis.com/video/?upload_id=123",
                    },
                    error: { code: "ok" },
                }),
            });

            const res = await initVideoPublish("token_123", {
                title: "My TikTok Video #trending",
                privacyLevel: "PUBLIC_TO_EVERYONE",
                videoSize: 5000000,
                isDraft: false,
            }, {});

            expect(res.publishId).toBe("v_pub_direct_123");
            expect(res.uploadUrl).toBe("https://open-upload.tiktokapis.com/video/?upload_id=123");
            expect(res.isDraft).toBe(false);
        });

        it("initializes draft post publish (inbox) when requested", async () => {
            globalThis.fetch = vi.fn().mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    data: {
                        publish_id: "v_pub_inbox_456",
                        upload_url: "https://open-upload.tiktokapis.com/video/?upload_id=456",
                    },
                    error: { code: "ok" },
                }),
            });

            const res = await initVideoPublish("token_123", {
                title: "Draft Video",
                videoSize: 5000000,
                isDraft: true,
            }, {});

            expect(res.publishId).toBe("v_pub_inbox_456");
            expect(res.isDraft).toBe(true);
        });

        it("automatically falls back to draft upload if direct publish audit scope is not authorized", async () => {
            // 1st call fails with unaudited scope
            // 2nd call succeeds for draft inbox
            globalThis.fetch = vi
                .fn()
                .mockResolvedValueOnce({
                    ok: false,
                    status: 400,
                    json: async () => ({
                        error: {
                            code: "unaudited_client_can_only_post_to_inbox",
                            message: "Unaudited client can only post to inbox",
                        },
                    }),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    status: 200,
                    json: async () => ({
                        data: {
                            publish_id: "v_pub_fallback_inbox_789",
                            upload_url: "https://open-upload.tiktokapis.com/video/?upload_id=789",
                        },
                        error: { code: "ok" },
                    }),
                });

            const res = await initVideoPublish("token_123", {
                title: "Auto-fallback Video",
                videoSize: 5000000,
                isDraft: false,
            }, {});

            expect(res.publishId).toBe("v_pub_fallback_inbox_789");
            expect(res.isDraft).toBe(true);
        });

        it("uploads video chunk with Content-Range", async () => {
            const mockFetch = vi.fn().mockResolvedValueOnce({
                ok: true,
                status: 200,
            });
            globalThis.fetch = mockFetch;

            const dummyBuffer = new Uint8Array([1, 2, 3, 4, 5]).buffer;
            const res = await uploadVideoChunk("https://open-upload.tiktokapis.com/video", dummyBuffer, 0, 4, 5);

            expect(res.success).toBe(true);
            expect(mockFetch.mock.calls[0][1].headers["Content-Range"]).toBe("bytes 0-4/5");
            expect(mockFetch.mock.calls[0][1].headers["Content-Length"]).toBe("5");
        });

        it("checks status of video publish", async () => {
            globalThis.fetch = vi.fn().mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    data: {
                        status: "SUCCESS",
                        publicly_available_post_id: ["7123456789"],
                    },
                    error: { code: "ok" },
                }),
            });

            const res = await checkPublishStatus("token_123", "v_pub_123", {});
            expect(res.status).toBe("SUCCESS");
            expect(res.publishId).toBe("v_pub_123");
        });
    });

    describe("TikTok Routes Integration", () => {
        function createMockDb() {
            const store = {
                users: [{ id: "user_test_1" }],
                sessions: [{ session_token: "tok_123", user_id: "user_test_1", expires_at: new Date(Date.now() + 1000000).toISOString() }],
                tiktok_accounts: [],
                posts: [],
            };

            const makeOps = (sql, args = []) => ({
                first: async () => {
                    if (sql.includes("SELECT user_id, expires_at FROM sessions")) {
                        return store.sessions[0];
                    }
                    if (sql.includes("SELECT id FROM users")) {
                        return store.users[0];
                    }
                    if (sql.includes("SELECT * FROM tiktok_accounts") || sql.includes("SELECT access_token FROM tiktok_accounts") || sql.includes("SELECT id, open_id")) {
                        return store.tiktok_accounts[0] || null;
                    }
                    return null;
                },
                all: async () => {
                    if (sql.includes("SELECT id, open_id") || sql.includes("SELECT id, union_id") || sql.includes("tiktok_accounts")) {
                        return { results: store.tiktok_accounts };
                    }
                    if (sql.includes("FROM posts")) {
                        return { results: store.posts };
                    }
                    return { results: [] };
                },
                run: async () => {
                    if (sql.includes("INSERT INTO tiktok_accounts")) {
                        store.tiktok_accounts.push({
                            id: args[0],
                            user_id: args[1],
                            open_id: args[2],
                            union_id: args[3],
                            username: args[4],
                            display_name: args[5],
                            avatar_url: args[6],
                            access_token: args[7],
                            refresh_token: args[8],
                            token_expires_at: args[9],
                        });
                    }
                    if (sql.includes("DELETE FROM tiktok_accounts")) {
                        store.tiktok_accounts = [];
                    }
                    if (sql.includes("UPDATE posts")) {
                        for (const p of store.posts) {
                            p.status = args[0];
                        }
                    }
                    if (sql.includes("INSERT INTO posts")) {
                        store.posts.push({ id: args[0], channel: "tiktok", post_id: args[5] });
                    }
                    return { success: true };
                },
            });

            return {
                prepare: vi.fn((sql) => ({
                    ...makeOps(sql),
                    bind: vi.fn((...args) => makeOps(sql, args)),
                })),
                _store: store,
            };
        }

        it("tiktokAuth returns 302 redirect with state and cookies", async () => {
            const db = createMockDb();
            const req = new Request("http://localhost:8787/api/tiktok/auth", {
                headers: { Cookie: "socialhub_session=tok_123" },
            });
            const env = {
                socialhub_db: db,
                TIKTOK_CLIENT_KEY: "test_key",
                TIKTOK_CLIENT_SECRET: "test_secret",
            };

            const res = await tiktokAuth(req, env);
            expect(res.status).toBe(302);
            const location = res.headers.get("Location");
            expect(location).toContain("https://www.tiktok.com/v2/auth/authorize/");
            expect(location).toContain("client_key=test_key");
            expect(res.headers.get("Set-Cookie")).toContain("tiktok_oauth_state");
        });

        it("tiktokCallback exchanges token, saves to D1, and redirects to frontend", async () => {
            const db = createMockDb();
            const state = `nonce123|user_test_1|http://localhost:8443|${encodeURIComponent("http://localhost:8787/api/tiktok/callback")}|verifier_abc`;
            const req = new Request(`http://localhost:8787/api/tiktok/callback?code=good_code&state=${encodeURIComponent(state)}`, {
                headers: { Cookie: "socialhub_session=tok_123; tiktok_code_verifier=verifier_abc" },
            });
            const env = {
                socialhub_db: db,
                TIKTOK_CLIENT_KEY: "test_key",
                TIKTOK_CLIENT_SECRET: "test_secret",
            };

            // Mock token exchange and user profile fetch
            globalThis.fetch = vi
                .fn()
                .mockResolvedValueOnce({
                    ok: true,
                    status: 200,
                    json: async () => ({
                        data: {
                            access_token: "act.callback_token_123",
                            open_id: "open_id_callback_123",
                            expires_in: 86400,
                            refresh_token: "rft.callback_123",
                        },
                    }),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    status: 200,
                    json: async () => ({
                        data: {
                            user: {
                                open_id: "open_id_callback_123",
                                username: "tiktok_star",
                                display_name: "TikTok Star",
                                avatar_url: "https://avatar.png",
                            },
                        },
                    }),
                });

            const res = await tiktokCallback(req, env);
            expect(res.status).toBe(302);
            const location = res.headers.get("Location");
            expect(location).toContain("http://localhost:8443/tiktok/callback");
            expect(location).toContain("platform=tiktok");
            expect(location).toContain("username=tiktok_star");
            expect(db._store.tiktok_accounts.length).toBe(1);
            expect(db._store.tiktok_accounts[0].username).toBe("tiktok_star");
        });

        it("getTikTokAccountsForUser returns accounts", async () => {
            const db = createMockDb();
            db._store.tiktok_accounts.push({
                id: "tt_1",
                open_id: "open_id_1",
                username: "star",
                display_name: "Star",
                avatar_url: "https://avatar.png",
            });

            const req = new Request("http://localhost:8787/api/tiktok/accounts", {
                headers: { Cookie: "socialhub_session=tok_123" },
            });
            const env = { socialhub_db: db };

            const res = await getTikTokAccountsForUser(req, env);
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.success).toBe(true);
            expect(data.accounts.length).toBe(1);
        });

        it("disconnectTikTokAccount revokes and deletes account", async () => {
            const db = createMockDb();
            db._store.tiktok_accounts.push({
                id: "tt_1",
                open_id: "open_id_1",
                username: "star",
                access_token: "token_to_disconnect",
            });

            globalThis.fetch = vi.fn().mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({}),
            });

            const req = new Request("http://localhost:8787/api/tiktok/disconnect", {
                method: "POST",
                headers: {
                    Cookie: "socialhub_session=tok_123",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ accountId: "open_id_1" }),
            });
            const env = {
                socialhub_db: db,
                TIKTOK_CLIENT_KEY: "test_key",
                TIKTOK_CLIENT_SECRET: "test_secret",
            };

            const res = await disconnectTikTokAccount(req, env);
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.success).toBe(true);
            expect(db._store.tiktok_accounts.length).toBe(0);
        });

        it("handleTikTokPost creates R2 object, publishes video to TikTok, and records in D1 posts", async () => {
            const db = createMockDb();
            db._store.tiktok_accounts.push({
                id: "tt_1",
                open_id: "open_id_1",
                username: "creator_star",
                access_token: "act.valid_publish_token",
            });

            const mockR2 = {
                put: vi.fn().mockResolvedValue({}),
            };

            // Mock init and status fetch
            globalThis.fetch = vi
                .fn()
                .mockResolvedValueOnce({
                    ok: true,
                    status: 200,
                    json: async () => ({
                        data: {
                            publish_id: "v_pub_video_123",
                            upload_url: "https://open-upload.tiktokapis.com/upload?id=123",
                        },
                    }),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    status: 200, // chunk upload
                })
                .mockResolvedValueOnce({
                    ok: true,
                    status: 200,
                    json: async () => ({
                        data: {
                            status: "PROCESSING_UPLOAD",
                        },
                    }),
                });

            const formData = new FormData();
            formData.append("title", "Check out my new video! #viral");
            formData.append("privacyLevel", "PUBLIC_TO_EVERYONE");
            const blob = new Blob(["dummy video binary data"], { type: "video/mp4" });
            formData.append("video", blob, "test_video.mp4");

            const req = new Request("http://localhost:8787/api/tiktok/post", {
                method: "POST",
                headers: {
                    Cookie: "socialhub_session=tok_123",
                },
                body: formData,
            });

            const env = {
                socialhub_db: db,
                socialhub_media: mockR2,
                TIKTOK_CLIENT_KEY: "test_key",
                TIKTOK_CLIENT_SECRET: "test_secret",
            };

            const res = await handleTikTokPost(req, env);
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.success).toBe(true);
            expect(data.publishId).toBe("v_pub_video_123");
            expect(mockR2.put).toHaveBeenCalledTimes(1);
            expect(db._store.posts.length).toBe(1);
            expect(db._store.posts[0].channel).toBe("tiktok");
        });

        describe("TikTok Status Tracking & Refresh", () => {
            it("mapTikTokStatus maps all statuses correctly", () => {
                expect(mapTikTokStatus("PUBLISH_COMPLETE")).toBe("published");
                expect(mapTikTokStatus("publish_complete")).toBe("published");
                expect(mapTikTokStatus("FAILED")).toBe("failed");
                expect(mapTikTokStatus("SEND_TO_USER_INBOX")).toBe("draft_sent");
                expect(mapTikTokStatus("PROCESSING_UPLOAD")).toBe("processing_upload");
                expect(mapTikTokStatus("PROCESSING_DOWNLOAD")).toBe("processing_upload");
                expect(mapTikTokStatus(null)).toBe("processing_upload");
                expect(mapTikTokStatus(undefined)).toBe("processing_upload");
                expect(mapTikTokStatus("UNKNOWN_CODE")).toBe("processing_upload");
            });

            it("fetchPublishStatus safely handles HTML response without throwing and returns null", async () => {
                const mockFetch = vi.fn().mockResolvedValueOnce({
                    ok: false,
                    status: 404,
                    url: "https://open.tiktokapis.com/v2/post/publish/status/fetch/",
                    text: async () => "<!DOCTYPE html><html><body>404 Not Found</body></html>",
                });
                globalThis.fetch = mockFetch;

                const res = await fetchPublishStatus("test_token", "pub_html_fail", {});
                expect(res).toBeNull();
                expect(mockFetch).toHaveBeenCalledTimes(1);
                const call = mockFetch.mock.calls[0];
                expect(call[0]).toBe("https://open.tiktokapis.com/v2/post/publish/status/fetch/");
                expect(call[1].method).toBe("POST");
                expect(call[1].headers["Authorization"]).toBe("Bearer test_token");
                expect(JSON.parse(call[1].body)).toEqual({ publish_id: "pub_html_fail" });
            });

            it("fetchPublishStatus parses JSON successfully", async () => {
                const mockFetch = vi.fn().mockResolvedValueOnce({
                    ok: true,
                    status: 200,
                    url: "https://open.tiktokapis.com/v2/post/publish/status/fetch/",
                    text: async () => JSON.stringify({
                        data: {
                            status: "PUBLISH_COMPLETE",
                            publicly_available_post_id: ["9988776655"],
                        },
                        error: { code: "ok" },
                    }),
                });
                globalThis.fetch = mockFetch;

                const res = await fetchPublishStatus("test_token", "pub_success_123", {});
                expect(res).not.toBeNull();
                expect(res.status).toBe("PUBLISH_COMPLETE");
                expect(res.publishId).toBe("pub_success_123");
            });

            it("handleTikTokPost returns HTTP 400 for unaudited_client_can_only_post_to_private_accounts", async () => {
                const db = createMockDb();
                db._store.tiktok_accounts.push({
                    id: "tt_1",
                    open_id: "open_id_1",
                    username: "creator_star",
                    access_token: "act.valid_token",
                });

                // Init fails with unaudited_client_can_only_post_to_private_accounts
                globalThis.fetch = vi.fn().mockResolvedValueOnce({
                    ok: false,
                    status: 400,
                    json: async () => ({
                        error: {
                            code: "unaudited_client_can_only_post_to_private_accounts",
                            message: "Unaudited client can only post to private accounts",
                        },
                    }),
                });

                const formData = new FormData();
                formData.append("title", "Testing unaudited private post");
                const blob = new Blob(["video data"], { type: "video/mp4" });
                formData.append("video", blob, "test.mp4");

                const req = new Request("http://localhost:8787/api/tiktok/post", {
                    method: "POST",
                    headers: { Cookie: "socialhub_session=tok_123" },
                    body: formData,
                });

                const env = {
                    socialhub_db: db,
                    TIKTOK_CLIENT_KEY: "test_key",
                    TIKTOK_CLIENT_SECRET: "test_secret",
                };

                const res = await handleTikTokPost(req, env);
                expect(res.status).toBe(400);
                const data = await res.json();
                expect(data.success).toBe(false);
                expect(data.code).toBe("unaudited_client_can_only_post_to_private_accounts");
                expect(data.error).toContain("must be private");
                expect(data.error).toContain("Only me");
            });

            it("handleTikTokRefreshStatus updates pending posts from processing_upload to final status", async () => {
                const db = createMockDb();
                db._store.tiktok_accounts.push({
                    id: "tt_1",
                    open_id: "open_id_1",
                    access_token: "act.refresh_test_token",
                    is_active: 1,
                });

                db._store.posts.push({
                    id: "post_pending_1",
                    user_id: "user_test_1",
                    channel: "tiktok",
                    page_id: "open_id_1",
                    post_id: "publish_tt_999",
                    status: "processing_upload",
                });

                // Mock fetchPublishStatus returning PUBLISH_COMPLETE
                globalThis.fetch = vi.fn().mockResolvedValueOnce({
                    ok: true,
                    status: 200,
                    url: "https://open.tiktokapis.com/v2/post/publish/status/fetch/",
                    text: async () => JSON.stringify({
                        data: {
                            status: "PUBLISH_COMPLETE",
                        },
                        error: { code: "ok" },
                    }),
                });

                const req = new Request("http://localhost:8787/api/tiktok/refresh-status", {
                    method: "POST",
                    headers: { Cookie: "socialhub_session=tok_123" },
                });

                const env = {
                    socialhub_db: db,
                };

                const res = await handleTikTokRefreshStatus(req, env);
                expect(res.status).toBe(200);
                const data = await res.json();
                expect(data.success).toBe(true);
                expect(data.checkedCount).toBe(1);
                expect(data.updatedCount).toBe(1);
                expect(db._store.posts[0].status).toBe("published");
            });
        });
    });
});
