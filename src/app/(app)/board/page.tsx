"use client";

import { useState, useCallback, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { KanbanBoard } from "@/components/kanban/kanban-board";
import { CreateTaskDialog } from "@/components/kanban/create-task-dialog";
import { CardDetailSheet } from "@/components/kanban/card-detail-sheet";
import { BoardFilterBar, type BoardFilters } from "@/components/kanban/board-filter-bar";
import { type TaskStatus } from "@/lib/columns";

function parseFilters(params: URLSearchParams): BoardFilters {
  return {
    projectId: params.get("project") ?? "all",
    assignee: params.get("assignee") ?? "all",
    priorities: params.get("priority")?.split(",").filter(Boolean) ?? [],
    tags: params.get("tags")?.split(",").filter(Boolean) ?? [],
    blockedOnly: params.get("blocked") === "true",
  };
}

function filtersToParams(filters: BoardFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.projectId !== "all") params.set("project", filters.projectId);
  if (filters.assignee !== "all") params.set("assignee", filters.assignee);
  if (filters.priorities.length > 0) params.set("priority", filters.priorities.join(","));
  if (filters.tags.length > 0) params.set("tags", filters.tags.join(","));
  if (filters.blockedOnly) params.set("blocked", "true");
  return params;
}

export default function BoardPage() {
  const projects = useQuery(api.projects.getAll);
  const tasks = useQuery(api.tasks.getAll);
  const searchParams = useSearchParams();
  const router = useRouter();

  const filters = useMemo(() => parseFilters(searchParams), [searchParams]);

  const handleFiltersChange = useCallback(
    (newFilters: BoardFilters) => {
      const params = filtersToParams(newFilters);
      const qs = params.toString();
      router.replace(qs ? `/board?${qs}` : "/board", { scroll: false });
    },
    [router]
  );

  const filteredTasks = useMemo(() => {
    if (!tasks) return [];
    return tasks.filter((t) => {
      if (filters.projectId !== "all" && t.projectId !== filters.projectId) return false;
      if (filters.assignee !== "all" && t.assignee !== filters.assignee) return false;
      if (filters.priorities.length > 0 && !filters.priorities.includes(t.priority)) return false;
      if (filters.tags.length > 0 && !filters.tags.some((tag) => t.tags.includes(tag))) return false;
      if (filters.blockedOnly && t.blockedBy.length === 0) return false;
      return true;
    });
  }, [tasks, filters]);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createDialogStatus, setCreateDialogStatus] = useState<TaskStatus>("backlog");
  const [detailTaskId, setDetailTaskId] = useState<Id<"tasks"> | null>(null);

  return (
    <>
      <BoardFilterBar
        projects={projects ?? []}
        filters={filters}
        onFiltersChange={handleFiltersChange}
      />

      <KanbanBoard
        projects={projects ?? []}
        tasks={filteredTasks}
        isLoading={projects === undefined || tasks === undefined}
        onAddTask={(status) => {
          setCreateDialogStatus(status);
          setCreateDialogOpen(true);
        }}
        onCardClick={(taskId) => setDetailTaskId(taskId)}
      />

      <CreateTaskDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        defaultStatus={createDialogStatus}
        projects={projects ?? []}
      />

      <CardDetailSheet
        taskId={detailTaskId}
        onClose={() => setDetailTaskId(null)}
        onNavigate={(id) => setDetailTaskId(id)}
        projects={projects ?? []}
      />
    </>
  );
}
