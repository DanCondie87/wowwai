"use client";

import { Plus } from "lucide-react";
import { Doc } from "../../../convex/_generated/dataModel";
import { type ColumnDef } from "@/lib/columns";
import { Button } from "@/components/ui/button";
import { TaskCard } from "@/components/kanban/task-card";

interface KanbanColumnProps {
  column: ColumnDef;
  tasks: Doc<"tasks">[];
  projects: Doc<"projects">[];
  onAddTask?: (status: string) => void;
  onCardClick?: (taskId: string) => void;
}

export function KanbanColumn({
  column,
  tasks,
  projects,
  onAddTask,
  onCardClick,
}: KanbanColumnProps) {
  const projectMap = new Map(projects.map((p) => [p._id, p]));

  return (
    <div className="flex w-72 flex-shrink-0 flex-col rounded-lg bg-muted/50 lg:w-72">
      {/* Column header */}
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground">
            {column.label}
          </h3>
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-xs font-medium text-muted-foreground">
            {tasks.length}
          </span>
        </div>
      </div>

      {/* Card list */}
      <div className="flex-1 space-y-2 overflow-y-auto px-2 pb-2">
        {tasks.length === 0 && (
          <p className="py-8 text-center text-xs text-muted-foreground">
            No tasks yet
          </p>
        )}
        {tasks.map((task) => (
          <TaskCard
            key={task._id}
            task={task}
            project={projectMap.get(task.projectId)}
            onClick={() => onCardClick?.(task._id)}
          />
        ))}
      </div>

      {/* Add button */}
      <div className="p-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground"
          onClick={() => onAddTask?.(column.id)}
        >
          <Plus className="h-4 w-4" />
          Add task
        </Button>
      </div>
    </div>
  );
}
