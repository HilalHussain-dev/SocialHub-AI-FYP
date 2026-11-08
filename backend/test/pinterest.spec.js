import { describe, it, expect, vi, beforeEach } from "vitest";
import {
    getPinterestApiBase,
    getOrCreateBoard,
    publishPinterestPin,
    exchangePinterestCodeForUserToken,
    arrayBufferToBase64,
} from "../src/services/pinterest.js";
import { handlePinterestPost } from "../src/routes/pinterest.js";

describe("Pinterest Service", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    describe("getPinterestApiBase", () => {
        it("returns sandbox URL when PINTEREST_USE_SANDBOX is 'true'", () => {
            expect(getPinterestApiBase({ PINTEREST_USE_SANDBOX: "true" })).toBe("https://api-sandbox.pinterest.com/v5");
        });

        it("returns sandbox URL when PINTEREST_ENVIRONMENT is 'sandbox'", () => {
            expect(getPinterestApiBase({ PINTEREST_ENVIRONMENT: "sandbox" })).toBe("https://api-sandbox.pinterest.com/v5");
        });

        it("returns production URL when env is undefined or PINTEREST_USE_SANDBOX is not 'true'", () => {
            expect(getPinterestApiBase({})).toBe("https://api.pinterest.com/v5");
            expect(getPinterestApiBase(undefined)).toBe("https://api.pinterest.com/v5");
            expect(getPinterestApiBase({ PINTEREST_USE_SANDBOX: "false" })).toBe("https://api.pinterest.com/v5");
        });

        it("respects custom PINTEREST_API_BASE", () => {
            expect(getPinterestApiBase({ PINTEREST_API_BASE: "https://custom.pinterest.com/v5/" })).toBe("https://custom.pinterest.com/v5");
        });
    });

    describe("exchangePinterestCodeForUserToken", () => {
        it("throws if appId or appSecret is missing from env", async () => {
            await expect(exchangePinterestCodeForUserToken("code123", "http://redirect", {})).rejects.toThrow(
                /PINTEREST_APP_ID and PINTEREST_APP_SECRET must be configured/
            );
        });
    });

    describe("getOrCreateBoard", () => {
        const env = { PINTEREST_USE_SANDBOX: "true" };

        it("returns an existing board with case-insensitive and trimmed name match", async () => {
            const mockFetch = vi.fn().mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    items: [
                        { id: "b1", name: "  socialhub pins  " },
                        { id: "b2", name: "Inspiration" },
                    ],
                    bookmark: null,
                }),
            });
            globalThis.fetch = mockFetch;

            const board = await getOrCreateBoard("test_token", "SocialHub Pins", env);
            expect(board.id).toBe("b1");
            expect(mockFetch).toHaveBeenCalledTimes(1);
            expect(mockFetch.mock.calls[0][0]).toContain("https://api-sandbox.pinterest.com/v5/boards");
        });

        it("follows pagination bookmark until null to find an existing board on page 2", async () => {
            const mockFetch = vi
                .fn()
                .mockResolvedValueOnce({
                    ok: true,
                    status: 200,
                    json: async () => ({
                        items: [{ id: "b1", name: "Other Board" }],
                        bookmark: "bookmark_page_2",
                    }),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    status: 200,
                    json: async () => ({
                        items: [{ id: "b2", name: "SocialHub Pins" }],
                        bookmark: null,
                    }),
                });
            globalThis.fetch = mockFetch;

            const board = await getOrCreateBoard("test_token", "socialhub pins", env);
            expect(board.id).toBe("b2");
            expect(mockFetch).toHaveBeenCalledTimes(2);
            expect(mockFetch.mock.calls[1][0]).toContain("bookmark=bookmark_page_2");
        });

        it("creates a new board when no matching board exists", async () => {
            const mockFetch = vi
                .fn()
                // List: empty
                .mockResolvedValueOnce({
                    ok: true,
                    status: 200,
                    json: async () => ({ items: [], bookmark: null }),
                })
                // Create
                .mockResolvedValueOnce({
                    ok: true,
                    status: 201,
                    json: async () => ({ id: "new_board_123", name: "SocialHub Pins" }),
                });
            globalThis.fetch = mockFetch;

            const board = await getOrCreateBoard("test_token", "SocialHub Pins", env);
            expect(board.id).toBe("new_board_123");
            expect(mockFetch).toHaveBeenCalledTimes(2);
        });

        it("retries listing when create fails with 'already have a board' and returns found board", async () => {
            const mockFetch = vi
                .fn()
                // Initial list: empty
                .mockResolvedValueOnce({
                    ok: true,
                    status: 200,
                    json: async () => ({ items: [], bookmark: null }),
                })
                // Create attempt: 400 duplicate
                .mockResolvedValueOnce({
                    ok: false,
                    status: 400,
                    json: async () => ({ code: 1, message: "Try a different name. You already have a board with this name!" }),
                })
                // Second list: now returns the board
                .mockResolvedValueOnce({
                    ok: true,
                    status: 200,
                    json: async () => ({ items: [{ id: "existing_b", name: "SocialHub Pins" }], bookmark: null }),
                });
            globalThis.fetch = mockFetch;

            const board = await getOrCreateBoard("test_token", "SocialHub Pins", env);
            expect(board.id).toBe("existing_b");
            expect(mockFetch).toHaveBeenCalledTimes(3);
        });

        it("reuses stored board ID immediately without making API calls", async () => {
            const mockFetch = vi.fn();
            globalThis.fetch = mockFetch;

            const board = await getOrCreateBoard("test_token", "SocialHub Pins", env, "stored_board_999");
            expect(board.id).toBe("stored_board_999");
            expect(mockFetch).not.toHaveBeenCalled();
        });

        it("creates a suffixed board once when create fails with 'already have a board' and board is still invisible in listing", async () => {
            const mockFetch = vi
                .fn()
                // 1. Initial list: empty
                .mockResolvedValueOnce({
                    ok: true,
                    status: 200,
                    json: async () => ({ items: [], bookmark: null }),
                })
                // 2. Create attempt: 400 duplicate
                .mockResolvedValueOnce({
                    ok: false,
                    status: 400,
                    json: async () => ({ code: 1, message: "You already have a board with this name!" }),
                })
                // 3. Second list: still empty
                .mockResolvedValueOnce({
                    ok: true,
                    status: 200,
                    json: async () => ({ items: [], bookmark: null }),
                })
                // 4. Create suffixed board once: 'SocialHub Pins (Default)'
                .mockResolvedValueOnce({
                    ok: true,
                    status: 201,
                    json: async () => ({ id: "suffixed_board_456", name: "SocialHub Pins (Default)" }),
                });
            globalThis.fetch = mockFetch;

            const board = await getOrCreateBoard("test_token", "SocialHub Pins", env);
            expect(board.id).toBe("suffixed_board_456");
            expect(mockFetch).toHaveBeenCalledTimes(4);
            const suffixedCreateBody = JSON.parse(mockFetch.mock.calls[3][1].body);
            expect(suffixedCreateBody.name).toBe("SocialHub Pins (Default)");
        });
    });

    describe("publishPinterestPin", () => {
        const env = { PINTEREST_USE_SANDBOX: "true" };

        it("sends image_base64 and returns pin object", async () => {
            const mockFetch = vi.fn().mockResolvedValueOnce({
                ok: true,
                status: 201,
                json: async () => ({ id: "pin_789" }),
            });
            globalThis.fetch = mockFetch;

            const result = await publishPinterestPin({
                boardId: "board_1",
                title: "Test Title",
                description: "Test Desc",
                imageBase64: "data:image/jpeg;base64,aGVsbG8=",
                imageContentType: "image/jpeg",
                accessToken: "token_abc",
                env,
            });

            expect(result.id).toBe("pin_789");
            expect(mockFetch).toHaveBeenCalledTimes(1);
            const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
            expect(callBody.media_source).toEqual({
                source_type: "image_base64",
                content_type: "image/jpeg",
                data: "aGVsbG8=",
            });
        });

        it("throws a clear Sandbox Authentication error on 401 in sandbox", async () => {
            const mockFetch = vi.fn().mockResolvedValueOnce({
                ok: false,
                status: 401,
                json: async () => ({ code: 2, message: "Authentication failed." }),
            });
            globalThis.fetch = mockFetch;

            await expect(
                publishPinterestPin({
                    boardId: "board_1",
                    imageBase64: "aGVsbG8=",
                    accessToken: "bad_token",
                    env,
                })
            ).rejects.toThrow(/Pinterest Sandbox Authentication Error/);
        });

        it("surfaces real API error in sandbox instead of Trial Access Restriction", async () => {
            const mockFetch = vi.fn().mockResolvedValueOnce({
                ok: false,
                status: 400,
                json: async () => ({ code: 1, message: "Invalid image format" }),
            });
            globalThis.fetch = mockFetch;

            await expect(
                publishPinterestPin({
                    boardId: "board_1",
                    imageBase64: "aGVsbG8=",
                    accessToken: "token_abc",
                    env,
                })
            ).rejects.toThrow("Invalid image format");
        });
    });

    describe("handlePinterestPost handler flow & caching", () => {
        const createMockDb = (initialAccount = {}) => {
            let account = {
                id: "acc_1",
                user_id: "user_1",
                pinterest_user_id: "pin_user_1",
                access_token: "test_access_token",
                business_name: "Test Business",
                default_board_id: null,
                ...initialAccount,
            };

            return {
                account,
                prepare: vi.fn((query) => ({
                    bind: vi.fn((...args) => ({
                        first: async () => {
                            if (query.includes("pinterest_accounts")) return account;
                            if (query.includes("users")) return { id: "user_1" };
                            return null;
                        },
                        all: async () => ({ results: [] }),
                        run: async () => {
                            if (query.includes("UPDATE pinterest_accounts SET default_board_id = ?")) {
                                account.default_board_id = args[0];
                            } else if (query.includes("UPDATE pinterest_accounts SET default_board_id = NULL")) {
                                account.default_board_id = null;
                            }
                            return { success: true };
                        },
                    })),
                    run: async () => ({ success: true }),
                    first: async () => account,
                })),
            };
        };

        it("uses client-provided boardId without querying default board", async () => {
            const mockDb = createMockDb();
            const mockFetch = vi.fn().mockResolvedValueOnce({
                ok: true,
                status: 201,
                json: async () => ({ id: "client_pin_1" }),
            });
            globalThis.fetch = mockFetch;

            const req = new Request("http://localhost/api/auth/pinterest/post", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    boardId: "client_custom_board",
                    imageBase64: "data:image/jpeg;base64,aGVsbG8=",
                }),
            });

            const res = await handlePinterestPost(req, {
                socialhub_db: mockDb,
                PINTEREST_USE_SANDBOX: "true",
            });

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.success).toBe(true);
            expect(data.boardId).toBe("client_custom_board");
            expect(data.postId).toBe("client_pin_1");
            expect(data.isSandbox).toBe(true);
            // Only 1 fetch call: to publish the pin
            expect(mockFetch).toHaveBeenCalledTimes(1);
        });

        it("resolves and caches default board on first post, reuses it on second post (acceptance criteria)", async () => {
            const mockDb = createMockDb();
            let fetchCount = 0;
            const mockFetch = vi.fn(async (url, opts) => {
                fetchCount++;
                const urlStr = url.toString();
                if (urlStr.includes("/boards") && opts.method === "POST") {
                    return {
                        ok: true,
                        status: 201,
                        json: async () => ({ id: "cached_board_123", name: "SocialHub Pins" }),
                    };
                }
                if (urlStr.includes("/boards")) {
                    return {
                        ok: true,
                        status: 200,
                        json: async () => ({ items: [], bookmark: null }),
                    };
                }
                if (urlStr.includes("/pins")) {
                    return {
                        ok: true,
                        status: 201,
                        json: async () => ({ id: `pin_${fetchCount}` }),
                    };
                }
                return { ok: false, status: 404, json: async () => ({ message: "Not found" }) };
            });
            globalThis.fetch = mockFetch;

            // Post 1: No board sent -> lists boards, creates board, caches in D1, publishes pin
            const req1 = new Request("http://localhost/api/auth/pinterest/post", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    imageBase64: "data:image/jpeg;base64,aGVsbG8=",
                }),
            });
            const res1 = await handlePinterestPost(req1, {
                socialhub_db: mockDb,
                PINTEREST_USE_SANDBOX: "true",
            });
            expect(res1.status).toBe(200);
            const data1 = await res1.json();
            expect(data1.boardId).toBe("cached_board_123");
            expect(mockDb.account.default_board_id).toBe("cached_board_123");

            // Reset mockFetch counter
            mockFetch.mockClear();

            // Post 2: No board sent -> reads cached default_board_id from D1, ZERO board calls made!
            const req2 = new Request("http://localhost/api/auth/pinterest/post", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    imageBase64: "data:image/jpeg;base64,aGVsbG8=",
                }),
            });
            const res2 = await handlePinterestPost(req2, {
                socialhub_db: mockDb,
                PINTEREST_USE_SANDBOX: "true",
            });
            expect(res2.status).toBe(200);
            const data2 = await res2.json();
            expect(data2.boardId).toBe("cached_board_123");

            // ONLY ONE Pinterest API call made (the pin create call) on the second post!
            expect(mockFetch).toHaveBeenCalledTimes(1);
            expect(mockFetch.mock.calls[0][0]).toContain("/pins");
        });

        it("clears cached board and recreates when Pinterest returns 'board not found'", async () => {
            const mockDb = createMockDb({ default_board_id: "deleted_board_id" });
            const mockFetch = vi.fn(async (url, opts) => {
                const urlStr = url.toString();
                if (urlStr.includes("/pins")) {
                    const body = JSON.parse(opts.body);
                    if (body.board_id === "deleted_board_id") {
                        return {
                            ok: false,
                            status: 404,
                            json: async () => ({ code: 404, message: "Board not found" }),
                        };
                    }
                    return {
                        ok: true,
                        status: 201,
                        json: async () => ({ id: "recovered_pin_1" }),
                    };
                }
                if (urlStr.includes("/boards") && opts.method === "POST") {
                    return {
                        ok: true,
                        status: 201,
                        json: async () => ({ id: "new_recovered_board", name: "SocialHub Pins" }),
                    };
                }
                if (urlStr.includes("/boards")) {
                    return {
                        ok: true,
                        status: 200,
                        json: async () => ({ items: [], bookmark: null }),
                    };
                }
                return { ok: false, status: 404, json: async () => ({ message: "Not found" }) };
            });
            globalThis.fetch = mockFetch;

            const req = new Request("http://localhost/api/auth/pinterest/post", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    imageBase64: "data:image/jpeg;base64,aGVsbG8=",
                }),
            });
            const res = await handlePinterestPost(req, {
                socialhub_db: mockDb,
                PINTEREST_USE_SANDBOX: "true",
            });

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.success).toBe(true);
            expect(data.boardId).toBe("new_recovered_board");
            expect(mockDb.account.default_board_id).toBe("new_recovered_board");
        });
    });
});

