import { describe, it, expect } from "vitest";
import {
  formatAge,
  formatMemoryCompact,
  formatMemoryList,
  formatMetadataBadges,
} from "../src/memory/formatting.ts";

describe("formatAge", () => {
  it("formats minutes", () => {
    expect(formatAge(new Date(Date.now() - 30 * 60_000))).toBe("30m ago");
  });

  it("formats hours", () => {
    expect(formatAge(new Date(Date.now() - 3 * 3_600_000))).toBe("3h ago");
  });

  it("formats days", () => {
    expect(formatAge(new Date(Date.now() - 5 * 86_400_000))).toBe("5d ago");
  });
});

describe("formatMetadataBadges", () => {
  it("renders agent-chosen metadata as [key:val] badges", () => {
    const badges = formatMetadataBadges({
      id: "x",
      metadata: { type: "decision", area: "auth" },
    });
    expect(badges).toBe("[type:decision] [area:auth]");
  });

  it("renders cloud categories as [category:x] badges", () => {
    expect(formatMetadataBadges({ id: "x", categories: ["preference"] })).toBe(
      "[category:preference]",
    );
  });

  it("hides internal/promoted payload keys", () => {
    const badges = formatMetadataBadges({
      id: "x",
      metadata: { app_id: "mem0", user_id: "alice", topic: "billing" },
    });
    expect(badges).toBe("[topic:billing]");
  });

  it("returns empty string when there are no tags", () => {
    expect(formatMetadataBadges({ id: "x" })).toBe("");
  });
});

describe("formatMemoryCompact", () => {
  it("shows metadata badges and id, and never '[uncategorized]'", () => {
    const line = formatMemoryCompact({
      id: "abc-123",
      memory: "User prefers dark mode",
      metadata: { type: "preference" },
      createdAt: new Date(),
    });
    expect(line).toContain("User prefers dark mode");
    expect(line).toContain("[type:preference]");
    expect(line).toContain("[mem0:abc-123]");
    expect(line).not.toContain("uncategorized");
  });
});

describe("formatMemoryList", () => {
  it("uses a two-line format: text+age, then badges+id", () => {
    const output = formatMemoryList([
      {
        id: "id-1",
        memory: "Proposed fix for questionnaire close",
        metadata: { type: "proposed-fix", area: "questionnaire" },
        createdAt: new Date(),
      },
    ]);
    const lines = output.split("\n");
    expect(lines[0]).toMatch(/^1\. Proposed fix for questionnaire close/);
    expect(lines[1]).toContain("[type:proposed-fix]");
    expect(lines[1]).toContain("[area:questionnaire]");
    expect(lines[1]).toContain("[mem0:id-1]");
    expect(output).not.toContain("uncategorized");
  });

  it("numbers multiple memories", () => {
    const output = formatMemoryList([
      { id: "id-1", memory: "Fact one", createdAt: new Date() },
      { id: "id-2", memory: "Fact two", createdAt: new Date() },
    ]);
    expect(output).toContain("1.");
    expect(output).toContain("2.");
  });

  it("returns empty message for no memories", () => {
    expect(formatMemoryList([])).toBe("No memories found.");
  });
});
