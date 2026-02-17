"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { KanbanBoard } from "@/components/kanban/kanban-board";

export default function BoardPage() {
  const projects = useQuery(api.projects.getAll);
  const tasks = useQuery(api.tasks.getAll);

  return (
    <KanbanBoard
      projects={projects ?? []}
      tasks={tasks ?? []}
      isLoading={projects === undefined || tasks === undefined}
    />
  );
}
