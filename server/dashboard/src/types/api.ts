export interface Memory {
  id: string;
  memory: string;
  user_id?: string;
  agent_id?: string;
  run_id?: string;
  app_id?: string;
  metadata?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
}

export interface MemoryHistoryItem {
  id: string;
  memory_id: string;
  old_memory: string | null;
  new_memory: string | null;
  event: string;
  created_at: string | null;
  updated_at: string | null;
  is_deleted: boolean;
  actor_id: string | null;
  role: string | null;
}

export interface ApiKey {
  id: string;
  label: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
}

export interface ApiKeyCreateResponse {
  id: string;
  label: string;
  key: string;
  key_prefix: string;
  created_at: string;
}

export interface ApiRequestLog {
  id: string;
  created_at: string;
  method: string;
  path: string;
  status_code: number;
  latency_ms: number;
  auth_type: string;
  user_id?: string | null;
  agent_id?: string | null;
  run_id?: string | null;
  app_id?: string | null;
}

export interface ApiRequestLogDetail extends ApiRequestLog {
  request_body?: string | null;
  response_body?: string | null;
}

export type EntityType = "user" | "agent" | "run" | "app";

export interface Entity {
  id: string;
  type: EntityType;
  total_memories: number;
  created_at: string | null;
  updated_at: string | null;
}
