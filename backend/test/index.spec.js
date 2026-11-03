import {
	env,
	createExecutionContext,
	waitOnExecutionContext,
	SELF,
} from "cloudflare:test";
import { describe, it, expect } from "vitest";
import worker from "../src";

describe("SocialHub Backend Worker", () => {
	it("responds with health check JSON (unit style)", async () => {
		const request = new Request("http://example.com/api/health");
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(200);
		const data = await response.json();
		expect(data.success).toBe(true);
		expect(data.service).toBe("SocialHub AI Backend");
	});

	it("responds with health check JSON (integration style)", async () => {
		const response = await SELF.fetch("http://example.com/api/health");
		expect(response.status).toBe(200);
		const data = await response.json();
		expect(data.success).toBe(true);
		expect(data.status).toBe("running");
	});
});

