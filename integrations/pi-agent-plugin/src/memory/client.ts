import MemoryClient, {
  type AddMemoryOptions,
  type DeleteAllMemoryOptions,
  type GetAllMemoryOptions,
  type Memory,
  type Message,
  type SearchMemoryOptions,
} from "mem0ai";

interface MemoryCollection {
  count?: number;
  results?: Memory[];
}

export interface MemoryClientLike {
  add(messages: Message[], options?: AddMemoryOptions & Record<string, unknown>): Promise<Memory[] | MemoryCollection>;
  search(query: string, options?: SearchMemoryOptions): Promise<{ results: Memory[] }>;
  getAll(options?: GetAllMemoryOptions): Promise<MemoryCollection>;
  update(memoryId: string, update: { text?: string; metadata?: Record<string, unknown> }): Promise<unknown>;
  delete(memoryId: string): Promise<{ message?: string }>;
  deleteAll(options?: DeleteAllMemoryOptions): Promise<{ message?: string }>;
}

interface SelfHostedClientOptions {
  host: string;
  apiKey?: string;
  fetch?: typeof globalThis.fetch;
}

const MAX_LIST_RESULTS = 1000;
const ENTITY_KEYS = ["user_id", "agent_id", "run_id", "app_id"] as const;

function normalizeHost(host: string): string {
  return host.replace(/\/+$/, "");
}

function snakeToCamelMemory(memory: Record<string, unknown>): Memory {
  const metadata = memory.metadata as Record<string, unknown> | undefined;
  return {
    ...memory,
    id: String(memory.id),
    userId: memory.user_id as string | undefined,
    agentId: memory.agent_id as string | undefined,
    runId: memory.run_id as string | undefined,
    appId: (memory.app_id ?? metadata?.app_id) as string | undefined,
    createdAt: memory.created_at as string | undefined,
    updatedAt: memory.updated_at as string | undefined,
    expirationDate: memory.expiration_date as string | null | undefined,
  } as Memory;
}

function entityParams(filters: Record<string, unknown> = {}): URLSearchParams {
  const params = new URLSearchParams();
  for (const key of ENTITY_KEYS) {
    const value = filters[key];
    // "*" is the "any app" wildcard (global scope) -- omit it so the server does not
    // filter on a literal "*" and return nothing.
    if (value != null && value !== "*") params.set(key, String(value));
  }
  return params;
}

export class SelfHostedMemoryClient implements MemoryClientLike {
  private readonly host: string;
  private readonly apiKey?: string;
  private readonly fetch: typeof globalThis.fetch;

  constructor(options: SelfHostedClientOptions) {
    this.host = normalizeHost(options.host);
    this.apiKey = options.apiKey;
    this.fetch = options.fetch ?? globalThis.fetch;
  }

  private async request(path: string, init: RequestInit = {}): Promise<unknown> {
    const headers = new Headers(init.headers);
    headers.set("Content-Type", "application/json");
    if (this.apiKey) headers.set("X-API-Key", this.apiKey);

    const response = await this.fetch(`${this.host}${path}`, { ...init, headers });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Mem0 request failed (${response.status}): ${detail}`);
    }
    return response.json();
  }

  async add(
    messages: Message[],
    options: AddMemoryOptions & Record<string, unknown> = {},
  ): Promise<MemoryCollection> {
    const { userId, agentId, appId, runId, customCategories: _customCategories, customInstructions, ...rest } = options;
    const metadata = (rest.metadata as Record<string, unknown> | undefined) ?? {};
    const body = {
      messages,
      ...(userId ? { user_id: userId } : {}),
      ...(agentId ? { agent_id: agentId } : {}),
      ...(runId ? { run_id: runId } : {}),
      ...(appId ? { app_id: appId } : {}),
      ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
      ...(rest.infer != null ? { infer: rest.infer } : {}),
      ...(rest.expirationDate != null ? { expiration_date: rest.expirationDate } : {}),
      ...(customInstructions ? { prompt: customInstructions } : {}),
    };
    const response = (await this.request("/memories", {
      method: "POST",
      body: JSON.stringify(body),
    })) as { results?: Record<string, unknown>[] };
    return { results: (response.results ?? []).map(snakeToCamelMemory) };
  }

  async search(query: string, options: SearchMemoryOptions = {}): Promise<{ results: Memory[] }> {
    const { filters = {}, topK, threshold } = options;
    const effectiveFilters = { ...filters };
    if (effectiveFilters.app_id === "*") delete effectiveFilters.app_id;

    const response = (await this.request("/search", {
      method: "POST",
      body: JSON.stringify({
        query,
        filters: effectiveFilters,
        ...(topK != null ? { top_k: topK } : {}),
        ...(threshold != null ? { threshold } : {}),
      }),
    })) as Record<string, unknown>[] | { results?: Record<string, unknown>[] };
    const results = Array.isArray(response) ? response : (response.results ?? []);
    return { results: results.map(snakeToCamelMemory) };
  }

  async getAll(options: GetAllMemoryOptions = {}): Promise<MemoryCollection> {
    const filters = options.filters ?? {};
    const params = entityParams(filters);
    params.set("top_k", String(MAX_LIST_RESULTS));

    const response = (await this.request(`/memories?${params}`)) as
      | Record<string, unknown>[]
      | { results?: Record<string, unknown>[] };
    const rawResults = Array.isArray(response) ? response : (response.results ?? []);
    const results = rawResults.map(snakeToCamelMemory);
    return { count: results.length, results };
  }

  async update(
    memoryId: string,
    update: { text?: string; metadata?: Record<string, unknown> },
  ): Promise<unknown> {
    return this.request(`/memories/${encodeURIComponent(memoryId)}`, {
      method: "PUT",
      body: JSON.stringify(update),
    });
  }

  async delete(memoryId: string): Promise<{ message?: string }> {
    return (await this.request(`/memories/${encodeURIComponent(memoryId)}`, {
      method: "DELETE",
    })) as { message?: string };
  }

  async deleteAll(options: DeleteAllMemoryOptions = {}): Promise<{ message?: string }> {
    const params = entityParams({
      ...(options.userId ? { user_id: options.userId } : {}),
      ...(options.agentId ? { agent_id: options.agentId } : {}),
      ...(options.runId ? { run_id: options.runId } : {}),
      ...(options.appId ? { app_id: options.appId } : {}),
    });
    return (await this.request(`/memories?${params}`, {
      method: "DELETE",
    })) as { message?: string };
  }
}

export function createMemoryClient(config: { apiKey: string; host: string }): MemoryClientLike {
  if (config.host) {
    return new SelfHostedMemoryClient({ host: config.host, apiKey: config.apiKey || undefined });
  }
  return new MemoryClient({ apiKey: config.apiKey });
}
