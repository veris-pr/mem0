import { describe, expect, it, vi } from "vitest";
import { SelfHostedMemoryClient } from "../src/memory/client.ts";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("SelfHostedMemoryClient", () => {
  it("maps add to OSS route, auth header, and first-class app_id", async () => {
    const fetch = vi.fn().mockResolvedValue(
      jsonResponse({ results: [{ id: "m1", memory: "Uses pnpm", event: "ADD" }] }),
    );
    const client = new SelfHostedMemoryClient({
      host: "http://localhost:8888/",
      apiKey: "local-key",
      fetch,
    });

    const result = await client.add([{ role: "user", content: "Uses pnpm" }], {
      userId: "alice",
      appId: "mem0",
      customCategories: [{ preferences: "Preferences" }],
      infer: false,
    });

    expect(fetch).toHaveBeenCalledOnce();
    const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8888/memories");
    expect(new Headers(init.headers).get("X-API-Key")).toBe("local-key");
    expect(JSON.parse(String(init.body))).toEqual({
      messages: [{ role: "user", content: "Uses pnpm" }],
      user_id: "alice",
      app_id: "mem0",
      infer: false,
    });
    expect(result.results?.[0].id).toBe("m1");
  });

  it("normalizes OSS search array and camel-cases memory fields", async () => {
    const fetch = vi.fn().mockResolvedValue(
      jsonResponse([
        {
          id: "m1",
          memory: "Uses pnpm",
          user_id: "alice",
          metadata: { app_id: "mem0" },
          created_at: "2026-07-12T00:00:00Z",
        },
      ]),
    );
    const client = new SelfHostedMemoryClient({ host: "http://localhost:8888", fetch });

    const result = await client.search("package manager", {
      filters: { user_id: "alice", app_id: "mem0" },
      topK: 10,
      threshold: 0.3,
      rerank: true,
    });

    const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8888/search");
    expect(JSON.parse(String(init.body))).toEqual({
      query: "package manager",
      filters: { user_id: "alice", app_id: "mem0" },
      top_k: 10,
      threshold: 0.3,
    });
    expect(result.results[0]).toMatchObject({
      id: "m1",
      userId: "alice",
      appId: "mem0",
      createdAt: "2026-07-12T00:00:00Z",
    });
  });

  it("passes app_id as a server-side query param on getAll", async () => {
    const fetch = vi.fn().mockResolvedValue(
      jsonResponse({
        results: [{ id: "m1", memory: "Mem0 fact", app_id: "mem0" }],
      }),
    );
    const client = new SelfHostedMemoryClient({ host: "http://localhost:8888", fetch });

    const result = await client.getAll({ filters: { user_id: "alice", app_id: "mem0" } });

    const [url] = fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/memories?");
    expect(url).toContain("user_id=alice");
    expect(url).toContain("app_id=mem0");
    expect(result).toMatchObject({ count: 1, results: [{ id: "m1", appId: "mem0" }] });
  });

  it("omits the '*' app wildcard so global getAll is not filtered on a literal '*'", async () => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse({ results: [] }));
    const client = new SelfHostedMemoryClient({ host: "http://localhost:8888", fetch });

    await client.getAll({ filters: { user_id: "alice", app_id: "*" } });

    const [url] = fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("user_id=alice");
    expect(url).not.toContain("app_id");
  });

  it("deletes an app scope with a single server-side delete_all call", async () => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse({ message: "All relevant memories deleted" }));
    const client = new SelfHostedMemoryClient({ host: "http://localhost:8888", fetch });

    await client.deleteAll({ userId: "alice", appId: "mem0" });

    expect(fetch).toHaveBeenCalledOnce();
    const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/memories?");
    expect(url).toContain("user_id=alice");
    expect(url).toContain("app_id=mem0");
    expect(init).toMatchObject({ method: "DELETE" });
  });

  it("surfaces non-success responses with status and body", async () => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse({ detail: "Invalid API key." }, 401));
    const client = new SelfHostedMemoryClient({ host: "http://localhost:8888", fetch });

    await expect(client.getAll({ filters: { user_id: "alice" } })).rejects.toThrow(
      'Mem0 request failed (401): {"detail":"Invalid API key."}',
    );
  });
});
