"use client";

import { useEffect, useRef, useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { DataTable } from "@/components/shared/data-table";
import { TableSkeleton } from "@/components/shared/table-skeleton";
import { EmptyState } from "@/components/self-hosted/empty-state";
import { RequestDetail } from "@/components/shared/request-detail";
import { api } from "@/utils/api";
import { REQUEST_ENDPOINTS } from "@/utils/api-endpoints";
import { useApiQuery } from "@/hooks/use-api-query";
import { ApiRequestLog, EntityType } from "@/types/api";

type RequestLog = {
  id: string;
  createdAt: string;
  method: string;
  path: string;
  statusCode: number;
  latencyMs: number;
  authType: string;
  userId?: string | null;
  appId?: string | null;
};

const REQUEST_LOG_LIMIT = 200;
const PAGE_SIZE = 20;

const ENTITY_FILTERS: { type: EntityType; label: string; param: string }[] = [
  { type: "user", label: "User", param: "user_id" },
  { type: "agent", label: "Agent", param: "agent_id" },
  { type: "run", label: "Run", param: "run_id" },
  { type: "app", label: "App", param: "app_id" },
];

const paramForType = (type: EntityType): string =>
  ENTITY_FILTERS.find((f) => f.type === type)?.param ?? "user_id";

// Read ?type=&id= (set when navigating here from the Entities page).
const initialFilterFromUrl = (): { type: EntityType; id: string } => {
  if (typeof window === "undefined") return { type: "user", id: "" };
  const params = new URLSearchParams(window.location.search);
  const type = params.get("type") as EntityType | null;
  const valid = ENTITY_FILTERS.some((f) => f.type === type);
  return {
    type: valid && type ? type : "user",
    id: params.get("id") ?? "",
  };
};

const getStatusClassName = (statusCode: number) => {
  if (statusCode >= 500) {
    return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-300";
  }

  if (statusCode >= 400) {
    return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-300";
  }

  return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-300";
};

const getMethodClassName = (method: string) => {
  switch (method.toUpperCase()) {
    case "POST":
      return "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/40 dark:bg-sky-950/40 dark:text-sky-300";
    case "PUT":
    case "PATCH":
      return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-300";
    case "DELETE":
      return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-300";
    default:
      return "border-memBorder-primary bg-surface-default-secondary text-onSurface-default-secondary";
  }
};

const getAuthLabel = (authType: string) => {
  switch (authType.toLowerCase()) {
    case "bearer":
      return "JWT";
    case "api_key":
      return "API Key";
    case "admin_api_key":
      return "Admin Key";
    case "disabled":
      return "Disabled";
    default:
      return "--";
  }
};

const normalizeLog = (entry: ApiRequestLog): RequestLog => {
  return {
    id: entry.id,
    createdAt: entry.created_at,
    method: entry.method,
    path: entry.path,
    statusCode: entry.status_code,
    latencyMs: entry.latency_ms,
    authType: entry.auth_type,
    userId: entry.user_id,
    appId: entry.app_id,
  };
};

export default function RequestsPage() {
  const initial = initialFilterFromUrl();
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [entityType, setEntityType] = useState<EntityType>(initial.type);
  const [entityId, setEntityId] = useState(initial.id);
  const [applied, setApplied] = useState<{ type: EntityType; id: string }>({
    type: initial.type,
    id: initial.id,
  });
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(
    null,
  );

  const {
    data: logs = [],
    isLoading,
    error,
    refetch,
  } = useApiQuery<RequestLog[]>(
    async () => {
      const params: Record<string, string | number> = {
        limit: REQUEST_LOG_LIMIT,
      };
      if (applied.id.trim()) {
        params[paramForType(applied.type)] = applied.id.trim();
      }
      const res = await api.get<ApiRequestLog[]>(REQUEST_ENDPOINTS.BASE, {
        params,
      });
      setLastUpdated(new Date().toISOString());
      return (res.data ?? []).map(normalizeLog);
    },
    { errorToast: "Failed to load request logs", initialData: [] },
  );

  // useApiQuery already fetches on mount; only refetch when the committed filter changes.
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    void refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applied]);

  const applyFilter = () => {
    setPage(0);
    setApplied({ type: entityType, id: entityId });
  };

  const clearFilter = () => {
    setEntityId("");
    setPage(0);
    setApplied({ type: entityType, id: "" });
  };

  const totalRequests = logs.length;
  const successfulRequests = logs.filter((log) => log.statusCode < 400).length;
  const successRate =
    totalRequests > 0
      ? Math.round((successfulRequests / totalRequests) * 100)
      : 0;
  const averageLatency =
    totalRequests > 0
      ? Math.round(
          logs.reduce((sum, log) => sum + log.latencyMs, 0) / totalRequests,
        )
      : 0;

  const columns = [
    {
      key: "createdAt" as keyof RequestLog,
      label: "Time",
      width: 140,
      render: (value: string) => (
        <span title={format(new Date(value), "PPpp")}>
          {formatDistanceToNow(new Date(value), { addSuffix: true })}
        </span>
      ),
    },
    {
      key: "method" as keyof RequestLog,
      label: "Method",
      width: 96,
      render: (value: string) => (
        <Badge variant="outline" className={getMethodClassName(value)}>
          {value.toUpperCase()}
        </Badge>
      ),
    },
    {
      key: "path" as keyof RequestLog,
      label: "Path",
      width: 360,
      render: (value: string) => (
        <span className="font-mono text-xs break-all text-onSurface-default-primary">
          {value}
        </span>
      ),
    },
    {
      key: "statusCode" as keyof RequestLog,
      label: "Status",
      width: 120,
      render: (value: number) => (
        <Badge variant="outline" className={getStatusClassName(value)}>
          {value}
        </Badge>
      ),
    },
    {
      key: "latencyMs" as keyof RequestLog,
      label: "Latency",
      width: 100,
      render: (value: number) => <span>{value} ms</span>,
    },
    {
      key: "authType" as keyof RequestLog,
      label: "Auth",
      width: 100,
      render: (value: string) => getAuthLabel(value),
    },
    {
      key: "userId" as keyof RequestLog,
      label: "User",
      width: 100,
      render: (value: string | null) => value || "--",
    },
    {
      key: "appId" as keyof RequestLog,
      label: "App",
      width: 100,
      render: (value: string | null) => value || "--",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold font-fustat">Requests</h1>
          <p className="text-sm text-onSurface-default-secondary">
            Recent request logs from your self-hosted instance.
          </p>
          {lastUpdated && (
            <p className="text-xs text-onSurface-default-tertiary">
              Last updated{" "}
              {formatDistanceToNow(new Date(lastUpdated), { addSuffix: true })}
            </p>
          )}
        </div>
        <Button
          variant="outline"
          onClick={() => {
            setPage(0);
            void refetch();
          }}
          disabled={isLoading}
        >
          <RefreshCw className="size-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[
          { label: "Total Requests", value: totalRequests },
          {
            label: "Success Rate",
            value: totalRequests > 0 ? `${successRate}%` : "--",
          },
          {
            label: "Avg Latency",
            value: totalRequests > 0 ? `${averageLatency} ms` : "--",
          },
        ].map((card) => (
          <Card key={card.label} className="border-memBorder-primary">
            <CardContent className="p-5">
              <p className="text-xs text-onSurface-default-tertiary">
                {card.label}
              </p>
              <p className="mt-1 text-2xl font-semibold">{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={entityType}
          onValueChange={(value) => setEntityType(value as EntityType)}
        >
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ENTITY_FILTERS.map((f) => (
              <SelectItem key={f.type} value={f.type}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          placeholder="Filter by entity ID (optional)"
          value={entityId}
          onChange={(e) => setEntityId(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") applyFilter();
          }}
          className="w-64"
        />
        <Button variant="outline" onClick={applyFilter} disabled={isLoading}>
          Filter
        </Button>
        {entityId.trim() && (
          <Button variant="ghost" size="icon" onClick={clearFilter}>
            <X className="size-4" />
          </Button>
        )}
      </div>

      {error && (
        <Card className="border-memBorder-primary">
          <CardContent className="p-4 text-sm text-onSurface-danger-primary">
            {error}
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <TableSkeleton rows={6} columns={6} />
      ) : logs.length === 0 ? (
        <EmptyState
          title="No request logs yet"
          description="Requests will appear here once your instance receives traffic."
          image="requests"
        />
      ) : (
        <>
          <Card className="border-memBorder-primary overflow-hidden">
            <DataTable
              data={logs.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)}
              columns={columns}
              getRowKey={(row) => row.id}
              onRowClick={(row) => setSelectedRequestId(row.id)}
              getRowClassName={(row) =>
                selectedRequestId === row.id
                  ? "bg-surface-default-tertiary"
                  : undefined
              }
            />
          </Card>
          {logs.length > PAGE_SIZE && (
            <div className="flex items-center justify-between text-sm text-onSurface-default-tertiary">
              <span>
                {page * PAGE_SIZE + 1}–
                {Math.min((page + 1) * PAGE_SIZE, logs.length)} of {logs.length}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={(page + 1) * PAGE_SIZE >= logs.length}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <Sheet
        open={!!selectedRequestId}
        onOpenChange={(open) => {
          if (!open) setSelectedRequestId(null);
        }}
      >
        <SheetContent className="sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Request Detail</SheetTitle>
            <SheetDescription className="sr-only">
              View request payload and resulting memory actions
            </SheetDescription>
          </SheetHeader>
          {selectedRequestId && <RequestDetail requestId={selectedRequestId} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}
