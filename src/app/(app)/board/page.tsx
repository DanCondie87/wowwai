"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { KanbanBoard } from "@/components/kanban/kanban-board";
import { CreateTaskDialog } from "@/components/kanban/create-task-dialog";
import { CardDetailSheet } from "@/components/kanban/card-detail-sheet";
import { type TaskStatus } from "@/lib/columns";

export default function BoardPage() {
  const projects = useQuery(api.projects.getAll);
  const tasks = useQuery(api.tasks.getAll);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createDialogStatus, setCreateDialogStatus] = useState<TaskStatus>("backlog");
  const [detailTaskId, setDetailTaskId] = useState<Id<"tasks"> | null>(null);

  return (
    <>
      <KanbanBoard
        projects={projects ?? []}
        tasks={tasks ?? []}
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
