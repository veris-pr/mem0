"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ScrollText, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/shared/data-table";
import { TableSkeleton } from "@/components/shared/table-skeleton";
import { EmptyState } from "@/components/self-hosted/empty-state";
import DeleteConfirmationModal from "@/components/ui/delete-confirmation-modal";
import { toast } from "@/components/ui/use-toast";
import { api } from "@/utils/api";
import { ENTITY_ENDPOINTS } from "@/utils/api-endpoints";
import { getErrorMessage } from "@/lib/error-message";
import { useApiQuery } from "@/hooks/use-api-query";
import { Entity } from "@/types/api";

export default function EntitiesPage() {
  const router = useRouter();
  const [entityToDelete, setEntityToDelete] = useState<Entity | null>(null);

  const viewMemories = (entity: Entity) => {
    router.push(
      `/dashboard/memories?type=${entity.type}&id=${encodeURIComponent(entity.id)}`,
    );
  };

  const viewRequests = (entity: Entity) => {
    router.push(
      `/dashboard/requests?type=${entity.type}&id=${encodeURIComponent(entity.id)}`,
    );
  };

  const {
    data: entities = [],
    isLoading,
    refetch,
  } = useApiQuery<Entity[]>(
    async () => {
      const res = await api.get<Entity[]>(ENTITY_ENDPOINTS.BASE);
      return res.data ?? [];
    },
    { errorToast: "Failed to load entities", initialData: [] },
  );

  const handleDelete = async () => {
    if (!entityToDelete) return;
    try {
      await api.delete(
        ENTITY_ENDPOINTS.BY_ID(entityToDelete.type, entityToDelete.id),
      );
      toast({ title: "Entity deleted", variant: "success" });
      setEntityToDelete(null);
      void refetch();
    } catch (error) {
      toast({
        title: "Failed to delete entity",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    }
  };

  const columns = [
    {
      key: "type" as keyof Entity,
      label: "Type",
      width: 100,
      render: (value: Entity["type"]) => (
        <Badge variant="outline" className="capitalize">
          {value}
        </Badge>
      ),
    },
    {
      key: "id" as keyof Entity,
      label: "ID",
      width: 280,
      render: (value: string) => (
        <span className="font-mono text-sm truncate">{value}</span>
      ),
    },
    {
      key: "total_memories" as keyof Entity,
      label: "Memories",
      width: 100,
      align: "right" as const,
    },
    {
      key: "updated_at" as keyof Entity,
      label: "Last Active",
      width: 140,
      render: (value: string | null) =>
        value ? format(new Date(value), "MMM d, yyyy") : "--",
    },
    {
      key: "id" as keyof Entity,
      label: "",
      width: 120,
      render: (_: string, row: Entity) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              viewRequests(row);
            }}
            className="size-7"
            title="View requests"
          >
            <ScrollText className="size-3.5 text-onSurface-default-secondary" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              viewMemories(row);
            }}
            className="size-7"
            title="View memories"
          >
            <ArrowRight className="size-3.5 text-onSurface-default-secondary" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              setEntityToDelete(row);
            }}
            className="size-7"
            title="Delete entity"
          >
            <Trash2 className="size-3.5 text-onSurface-danger-primary" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold font-fustat">Entities</h1>

      {isLoading ? (
        <TableSkeleton rows={5} columns={5} />
      ) : entities.length === 0 ? (
        <EmptyState
          title="No entities yet"
          description="Entities appear once memories are stored with a user_id, agent_id, run_id, or app_id."
        />
      ) : (
        <Card className="border-memBorder-primary overflow-hidden">
          <DataTable
            data={entities}
            columns={columns}
            getRowKey={(row) => `${row.type}:${row.id}`}
            onRowClick={viewMemories}
          />
        </Card>
      )}

      <DeleteConfirmationModal
        isOpen={!!entityToDelete}
        onClose={() => setEntityToDelete(null)}
        onConfirm={handleDelete}
        title="Delete entity"
        description="All memories associated with this entity will be permanently removed. This cannot be undone."
        itemName={entityToDelete?.id ?? ""}
        confirmButtonText="Delete"
      />
    </div>
  );
}
