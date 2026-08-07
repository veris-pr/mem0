"use client";

import { format } from "date-fns";
import { Trash2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/misc/spinner";
import { EventBadge } from "@/components/shared/event-badge";
import { api } from "@/utils/api";
import { MEMORY_ENDPOINTS } from "@/utils/api-endpoints";
import { useApiQuery } from "@/hooks/use-api-query";
import { Memory, MemoryHistoryItem } from "@/types/api";

const ENTITY_FIELDS: { key: keyof Memory; label: string }[] = [
  { key: "user_id", label: "User" },
  { key: "agent_id", label: "Agent" },
  { key: "run_id", label: "Run" },
  { key: "app_id", label: "App" },
];

function formatTimestamp(value: string | null | undefined): string {
  if (!value) return "--";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "--" : format(date, "PPpp");
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

function UpdateHistory({ memoryId }: { memoryId: string }) {
  const { data: history = [], isLoading } = useApiQuery<MemoryHistoryItem[]>(
    async () => {
      const res = await api.get<MemoryHistoryItem[]>(
        MEMORY_ENDPOINTS.HISTORY(memoryId),
      );
      return Array.isArray(res.data) ? res.data : [];
    },
    { errorToast: "Failed to load memory history", initialData: [] },
  );

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-onSurface-default-tertiary">
        <Spinner className="size-3.5" /> Loading history…
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <p className="text-xs text-onSurface-default-tertiary">
        No change history recorded for this memory.
      </p>
    );
  }

  return (
    <ol className="space-y-3 border-l border-memBorder-primary pl-4">
      {history.map((item) => (
        <li key={item.id} className="relative">
          <span className="absolute -left-[21px] top-1 size-2 rounded-full bg-surface-default-fg-secondary" />
          <div className="flex items-center gap-2">
            <EventBadge event={item.event} label={item.event.toUpperCase()} />
            <span className="text-xs text-onSurface-default-tertiary">
              {formatTimestamp(item.created_at)}
            </span>
          </div>
          {item.event.toUpperCase() === "UPDATE" && item.old_memory ? (
            <div className="mt-1.5 space-y-1 text-sm">
              <p className="text-onSurface-default-tertiary line-through">
                {item.old_memory}
              </p>
              <p className="text-onSurface-default-primary">
                {item.new_memory}
              </p>
            </div>
          ) : item.event.toUpperCase() === "DELETE" ? (
            <p className="mt-1.5 text-sm text-onSurface-default-tertiary line-through">
              {item.old_memory}
            </p>
          ) : (
            <p className="mt-1.5 text-sm text-onSurface-default-primary">
              {item.new_memory ?? item.old_memory}
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}

export function MemoryDetail({
  memory,
  onDelete,
}: {
  memory: Memory;
  onDelete: () => void;
}) {
  const entities = ENTITY_FIELDS.filter((field) => memory[field.key]);
  const metadataEntries = Object.entries(memory.metadata ?? {});

  return (
    <ScrollArea className="h-[calc(100vh-8rem)] pr-4">
      <div className="mt-6 space-y-6">
        <DetailSection title="Memory saved">
          <p className="text-sm text-onSurface-default-primary">
            {memory.memory}
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
                    {String(memory[field.key])}
                  </span>
                </Badge>
              ))}
            </div>
          </DetailSection>
        )}

        <DetailSection title="Metadata">
          {metadataEntries.length > 0 ? (
            <div className="rounded-md border border-memBorder-primary bg-surface-default-secondary p-3 space-y-1.5">
              {metadataEntries.map(([key, value]) => (
                <div
                  key={key}
                  className="flex items-start justify-between gap-3 text-xs"
                >
                  <span className="font-mono text-onSurface-default-tertiary">
                    {key}
                  </span>
                  <span className="font-mono break-all text-right text-onSurface-default-primary">
                    {typeof value === "object"
                      ? JSON.stringify(value)
                      : String(value)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-onSurface-default-tertiary">
              No metadata attached.
            </p>
          )}
        </DetailSection>

        <DetailSection title="Details">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="space-y-1">
              <Label className="text-xs text-onSurface-default-tertiary">
                ID
              </Label>
              <p className="text-xs font-mono break-all">{memory.id}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-onSurface-default-tertiary">
                Created
              </Label>
              <p className="text-sm">{formatTimestamp(memory.created_at)}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-onSurface-default-tertiary">
                Updated
              </Label>
              <p className="text-sm">{formatTimestamp(memory.updated_at)}</p>
            </div>
          </div>
        </DetailSection>

        <DetailSection title="Updates">
          <UpdateHistory memoryId={memory.id} />
        </DetailSection>

        <Button
          variant="outline"
          size="sm"
          className="text-onSurface-danger-primary"
          onClick={onDelete}
        >
          <Trash2 className="size-3.5 mr-1" />
          Delete memory
        </Button>
      </div>
    </ScrollArea>
  );
}
