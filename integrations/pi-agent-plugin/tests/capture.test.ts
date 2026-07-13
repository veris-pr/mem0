import { describe, it, expect, vi } from "vitest";
import { extractConversation, setupAutoCapture } from "../src/capture/index.ts";

describe("extractConversation", () => {
  it("extracts user and assistant text messages", () => {
    const messages = [
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi there!" },
    ];
    const result = extractConversation(messages);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ role: "user", content: "Hello" });
    expect(result[1]).toEqual({ role: "assistant", content: "Hi there!" });
  });

  it("skips assistant tool_use blocks, keeps text blocks", () => {
    const messages = [
      { role: "user", content: "Search" },
      { role: "assistant", content: [{ type: "tool_use", id: "x", name: "mem0" }] },
      { role: "tool", content: "results" },
      { role: "assistant", content: "Here are the results" },
    ];
    const result = extractConversation(messages);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ role: "user", content: "Search" });
    expect(result[1]).toEqual({ role: "assistant", content: "Here are the results" });
  });

  it("extracts text from content arrays for both roles", () => {
    const messages = [
      { role: "user", content: [{ type: "text", text: "Hello world" }] },
      { role: "assistant", content: [{ type: "text", text: "Response" }, { type: "tool_use", id: "x" }] },
    ];
    const result = extractConversation(messages);
    expect(result).toHaveLength(2);
    expect(result[0].content).toBe("Hello world");
    expect(result[1].content).toBe("Response");
  });

  it("skips tool and system messages", () => {
    const messages = [
      { role: "system", content: "You are helpful" },
      { role: "user", content: "Hi" },
      { role: "tool", content: "tool output" },
    ];
    const result = extractConversation(messages);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ role: "user", content: "Hi" });
  });

  it("skips assistant messages with only tool_use (no text)", () => {
    const messages = [
      { role: "assistant", content: [{ type: "tool_use", id: "x", name: "bash" }] },
    ];
    const result = extractConversation(messages);
    expect(result).toHaveLength(0);
  });

  it("returns empty array for empty input", () => {
    expect(extractConversation([])).toEqual([]);
  });
});

describe("setupAutoCapture", () => {
  const buildPi = (handlers: Record<string, (...a: any[]) => any>) =>
    ({
      on: (evt: string, fn: (...a: any[]) => any) => {
        handlers[evt] = fn;
      },
    }) as any;

  it("does not tag auto-captured memories with category metadata", async () => {
    const handlers: Record<string, (...a: any[]) => any> = {};
    const mem0 = { add: vi.fn().mockResolvedValue({ results: [] }) } as any;
    setupAutoCapture(
      buildPi(handlers),
      mem0,
      { autoCapture: true } as any,
      () => ({ userId: "u", appId: "a", runId: "r" }),
    );

    await handlers["agent_end"]({
      messages: [
        { role: "user", content: "Hi" },
        { role: "assistant", content: "Hello" },
      ],
    });

    expect(mem0.add).toHaveBeenCalledTimes(1);
    // Auto-capture is passive -- only agent-curated saves carry category tags.
    expect(mem0.add.mock.calls[0][1].metadata).toBeUndefined();
  });

  it("does not register the hook when autoCapture is disabled", () => {
    const handlers: Record<string, (...a: any[]) => any> = {};
    setupAutoCapture(
      buildPi(handlers),
      { add: vi.fn() } as any,
      { autoCapture: false } as any,
      () => ({ userId: "u", appId: "a", runId: "r" }),
    );
    expect(handlers["agent_end"]).toBeUndefined();
  });
});
