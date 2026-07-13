"use client";

import { format } from "date-fns";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/misc/spinner";
import { EventBadge } from "@/components/shared/event-badge";
import { api } from "@/utils/api";
import { REQUEST_ENDPOINTS } from "@/utils/api-endpoints";
import { useApiQuery } from "@/hooks/use-api-query";
import { ApiRequestLogDetail } from "@/types/api";

const ENTITY_FIELDS: {
  key: keyof ApiRequestLogDetail;
  label: string;
}[] = [
  { key: "user_id", label: "User" },
  { key: "agent_id", label: "Agent" },
  { key: "run_id", label: "Run" },
  { key: "app_id", label: "App" },
];

type MemoryAction = {
  id?: string;
  memory?: string;
  event?: string;
  [key: string]: unknown;
};

function prettyJson(raw: string | null | undefined): string {
  if (!raw) return "";
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

// Pull memory actions (ADD/UPDATE/DELETE items) out of a captured response body.
function parseActions(raw: string | null | undefined): MemoryAction[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as MemoryAction[];
    if (Array.isArray(parsed?.results)) return parsed.results as MemoryAction[];
    if (parsed?.event) return [parsed as MemoryAction];
    return [];
  } catch {
    return [];
  }
}

function CodeBlock({ content }: { content: string }) {
  return (
    <pre className="max-h-72 overflow-auto rounded-md border border-memBorder-primary bg-surface-default-secondary p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap break-words">
      {content}
    </pre>
  );
}

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-xs uppercase tracking-wide text-onSurface-default-tertiary">
        {title}
      </Label>
      {children}
    </div>
  );
}

export function RequestDetail({ requestId }: { requestId: string }) {
  const { data, isLoading, error } = useApiQuery<ApiRequestLogDetail | null>(
    async () => {
      const res = await api.get<ApiRequestLogDetail>(
        REQUEST_ENDPOINTS.BY_ID(requestId),
      );
      return res.data ?? null;
    },
    { errorToast: "Failed to load request details", initialData: null },
  );

  if (isLoading) {
    return (
      <div className="mt-6 flex items-center gap-2 text-xs text-onSurface-default-tertiary">
        <Spinner className="size-3.5" /> Loading request…
      </div>
    );
  }

  if (error || !data) {
    return (
      <p className="mt-6 text-sm text-onSurface-danger-primary">
        {error || "Request not found."}
      </p>
    );
  }

  const entities = ENTITY_FIELDS.filter((field) => data[field.key]);
  const actions = parseActions(data.response_body);
  const hasBodies = data.request_body || data.response_body;

  return (
    <ScrollArea className="h-[calc(100vh-8rem)] pr-4">
      <div className="mt-6 space-y-6">
        <DetailSection title="Overview">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="font-mono">
              {data.method.toUpperCase()}
            </Badge>
            <span className="font-mono text-sm break-all text-onSurface-default-primary">
              {data.path}
            </span>
          </div>
          <p className="text-xs text-onSurface-default-tertiary">
            {data.status_code} · {data.latency_ms} ms ·{" "}
            {format(new Date(data.created_at), "PPpp")}
          </p>
        </DetailSection>

        {entities.length > 0 && (
          <DetailSection title="Entities">
            <div className="flex flex-wrap gap-2">
              {entities.map((field) => (
                <Badge
                  key={field.key}
                  variant="outline"
                  className="font-normal"
                >
                  <span className="text-onSurface-default-tertiary">
                    {field.label}:
                  </span>
                  <span className="ml-1 font-mono">
                    {String(data[field.key])}
                  </span>
                </Badge>
              ))}
            </div>
          </DetailSection>
        )}

        {data.request_body && (
          <DetailSection title="Request payload">
            <CodeBlock content={prettyJson(data.request_body)} />
          </DetailSection>
        )}

        {actions.length > 0 && (
          <DetailSection title="Memory actions">
            <ul className="space-y-2">
              {actions.map((action, index) => (
                <li
                  key={action.id ?? index}
                  className="flex items-start gap-2 rounded-md border border-memBorder-primary p-2"
                >
                  <EventBadge
                    event={action.event ?? "ADD"}
                    label={(action.event ?? "ADD").toUpperCase()}
                  />
                  <span className="text-sm text-onSurface-default-primary">
                    {String(
                      action.memory ??
                        action.memory_id ??
                        JSON.stringify(action),
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </DetailSection>
        )}

        {data.response_body && actions.length === 0 && (
          <DetailSection title="Response">
            <CodeBlock content={prettyJson(data.response_body)} />
          </DetailSection>
        )}

        {!hasBodies && (
          <p className="text-xs text-onSurface-default-tertiary">
            No payload was captured for this request. Payloads are recorded for
            memory operations (add, search, update, delete).
          </p>
        )}
      </div>
    </ScrollArea>
  );
}
