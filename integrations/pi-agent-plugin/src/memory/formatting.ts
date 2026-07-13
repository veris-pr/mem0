interface MemoryLike {
  id: string;
  memory?: string;
  categories?: string[];
  metadata?: Record<string, unknown> | null;
  createdAt?: Date | string;
}

// Payload keys that Mem0 manages internally or promotes to top-level fields. They must
// never be shown as user-facing category tags.
const HIDDEN_METADATA_KEYS = new Set([
  "data",
  "hash",
  "created_at",
  "updated_at",
  "expiration_date",
  "text_lemmatized",
  "role",
  "actor_id",
  "user_id",
  "agent_id",
  "run_id",
  "app_id",
]);

const MAX_BADGE_VALUE_LEN = 40;

export function formatAge(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const ms = Date.now() - d.getTime();
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function badgeValue(value: unknown): string {
  const str = typeof value === "object" ? JSON.stringify(value) : String(value);
  return str.length > MAX_BADGE_VALUE_LEN
    ? `${str.slice(0, MAX_BADGE_VALUE_LEN - 1)}…`
    : str;
}

/**
 * Render a memory's agent-chosen category tags as `[key:val]` badges. Cloud
 * `categories` (label-only) render as `[category:label]`. Internal payload keys are
 * hidden. Returns "" when there is nothing to show.
 */
export function formatMetadataBadges(mem: MemoryLike): string {
  const parts: string[] = [];
  for (const category of mem.categories ?? []) {
    parts.push(`[category:${category}]`);
  }
  for (const [key, value] of Object.entries(mem.metadata ?? {})) {
    if (HIDDEN_METADATA_KEYS.has(key) || value == null) continue;
    parts.push(`[${key}:${badgeValue(value)}]`);
  }
  return parts.join(" ");
}

/** Single-line rendering for interactive pickers/confirmations. */
export function formatMemoryCompact(mem: MemoryLike): string {
  const age = mem.createdAt ? ` (${formatAge(mem.createdAt)})` : "";
  const badges = formatMetadataBadges(mem);
  const trailer = [badges, `[mem0:${mem.id}]`].filter(Boolean).join(" ");
  return `${mem.memory ?? "(empty)"}${age} ${trailer}`;
}

/**
 * Two-line rendering for lists: memory text + age on the first line, then the
 * category badges and id on an indented second line.
 */
export function formatMemoryList(memories: MemoryLike[]): string {
  if (memories.length === 0) return "No memories found.";
  return memories
    .map((m, i) => {
      const age = m.createdAt ? ` (${formatAge(m.createdAt)})` : "";
      const badges = formatMetadataBadges(m);
      const trailer = [badges, `[mem0:${m.id}]`].filter(Boolean).join(" ");
      return `${i + 1}. ${m.memory ?? "(empty)"}${age}\n   ${trailer}`;
    })
    .join("\n");
}

