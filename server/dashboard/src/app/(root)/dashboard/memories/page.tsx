"use client";

import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTable } from "@/components/shared/data-table";
import { TableSkeleton } from "@/components/shared/table-skeleton";
import { EmptyState } from "@/components/self-hosted/empty-state";
import { MemoryDetail } from "@/components/shared/memory-detail";
import DeleteConfirmationModal from "@/components/ui/delete-confirmation-modal";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { UpgradeBanner } from "@/components/self-hosted/upgrade-banner";
import { toast } from "@/components/ui/use-toast";
import { getErrorMessage } from "@/lib/error-message";
import { api } from "@/utils/api";
import { MEMORY_ENDPOINTS } from "@/utils/api-endpoints";
import { useApiQuery } from "@/hooks/use-api-query";
import { EntityType, Memory } from "@/types/api";

const PAGE_SIZE = 20;
// Keep in sync with ALL_MEMORIES_LIMIT in server/main.py.
const MEMORY_FETCH_LIMIT = 1000;

const ENTITY_FILTERS: { type: EntityType; label: string; param: string }[] = [
  { type: "user", label: "User", param: "user_id" },
  { type: "agent", label: "Agent", param: "agent_id" },
  { type: "run", label: "Run", param: "run_id" },
  { type: "app", label: "App", param: "app_id" },
];

const paramForType = (type: EntityType): string =>
  ENTITY_FILTERS.find((f) => f.type === type)?.param ?? "user_id";

// Read ?type=&id= (set when navigating here from the Entities page) so the list
// opens pre-filtered to the chosen entity.
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

export default function MemoriesPage() {
  const initial = initialFilterFromUrl();
  // Draft filter bound to the controls; `applied` is what the fetch actually uses.
  const [entityType, setEntityType] = useState<EntityType>(initial.type);
  const [entityId, setEntityId] = useState(initial.id);
  const [applied, setApplied] = useState<{ type: EntityType; id: string }>({
    type: initial.type,
    id: initial.id,
  });
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null);
  const [memoryToDelete, setMemoryToDelete] = useState<Memory | null>(null);
  const [page, setPage] = useState(0);
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";

  const {
    data: memories = [],
    isLoading,
    refetch,
  } = useApiQuery<Memory[]>(
    async () => {
      const params: Record<string, string | number> = {
        top_k: MEMORY_FETCH_LIMIT,
      };
      if (applied.id.trim()) {
        params[paramForType(applied.type)] = applied.id.trim();
      }
      const res = await api.get(MEMORY_ENDPOINTS.BASE, { params });
      const raw = res.data?.results ?? res.data ?? [];
      return Array.isArray(raw) ? raw : [];
    },
    { errorToast: "Failed to load memories", initialData: [] },
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

  const totalPages = Math.ceil(memories.length / PAGE_SIZE);
  const paginatedMemories = memories.slice(
    page * PAGE_SIZE,
    (page + 1) * PAGE_SIZE,
  );

  const handleDelete = async () => {
    if (!memoryToDelete) return;
    try {
      await api.delete(MEMORY_ENDPOINTS.BY_ID(memoryToDelete.id));
      toast({ title: "Memory deleted", variant: "success" });
      if (selectedMemory?.id === memoryToDelete.id) setSelectedMemory(null);
      setMemoryToDelete(null);
      void refetch();
    } catch (error) {
      toast({
        title: "Failed to delete memory",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    }
  };

  const columns = [
    {
      key: "memory" as keyof Memory,
      label: "Content",
      width: 400,
      render: (value: string) => (
        <span className="line-clamp-2 text-sm">{value}</span>
      ),
    },
    { key: "user_id" as keyof Memory, label: "User", width: 100 },
    { key: "agent_id" as keyof Memory, label: "Agent", width: 100 },
    { key: "app_id" as keyof Memory, label: "App", width: 100 },
    {
      key: "created_at" as keyof Memory,
      label: "Created",
      width: 120,
      render: (value: string) =>
        value ? format(new Date(value), "MMM d, yyyy") : "--",
    },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold font-fustat">Memories</h1>

      {memories.length >= MEMORY_FETCH_LIMIT && (
        <UpgradeBanner
          id="memories-1k"
          message="1,000+ memories stored. Categories can help organize them."
          ctaLabel="Explore Cloud"
          ctaUrl="https://app.mem0.ai?utm_source=oss&utm_medium=dashboard-memories"
          variant="cloud"
        />
      )}

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

      {isLoading ? (
        <TableSkeleton rows={5} columns={4} />
      ) : memories.length === 0 ? (
        <EmptyState
          title="No memories yet"
          description="Create your first memory by sending a POST /memories request."
        >
          <pre className="text-xs text-left bg-surface-default-secondary p-3 rounded font-mono overflow-x-auto mt-3 max-w-lg">
            {`curl -X POST ${apiUrl}/memories \\
  -H "X-API-Key: <your-key>" \\
  -H "Content-Type: application/json" \\
  -d '{"messages": [{"role": "user", "content": "I like hiking"}], "user_id": "alice"}'`}
          </pre>
          <a
            href="https://docs.mem0.ai/open-source/features/rest-api#memory-operations"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-onSurface-default-tertiary underline underline-offset-4 hover:text-onSurface-default-primary mt-2"
          >
            REST API reference
          </a>
        </EmptyState>
      ) : (
        <>
          <Card className="border-memBorder-primary overflow-hidden">
            <DataTable
              data={paginatedMemories}
              columns={columns}
              getRowKey={(row) => row.id}
              onRowClick={(row) => setSelectedMemory(row)}
              getRowClassName={(row) =>
                selectedMemory?.id === row.id
                  ? "bg-surface-default-tertiary"
                  : undefined
              }
            />
          </Card>
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-onSurface-default-tertiary">
              <span>
                {page * PAGE_SIZE + 1}–
                {Math.min((page + 1) * PAGE_SIZE, memories.length)} of{" "}
                {memories.length}
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
                  disabled={page >= totalPages - 1}
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
        open={!!selectedMemory}
        onOpenChange={(open) => {
          if (!open) setSelectedMemory(null);
        }}
      >
        <SheetContent className="sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Memory Detail</SheetTitle>
            <SheetDescription className="sr-only">
              View memory content, metadata, entities, and update history
            </SheetDescription>
          </SheetHeader>
          {selectedMemory && (
            <MemoryDetail
              memory={selectedMemory}
              onDelete={() => setMemoryToDelete(selectedMemory)}
            />
          )}
        </SheetContent>
      </Sheet>

      <DeleteConfirmationModal
        isOpen={!!memoryToDelete}
        onClose={() => setMemoryToDelete(null)}
        onConfirm={handleDelete}
        title="Delete memory"
        description="This memory will be permanently removed. This cannot be undone."
        itemName={memoryToDelete?.id ?? ""}
        confirmButtonText="Delete"
      />
    </div>
  );
}
