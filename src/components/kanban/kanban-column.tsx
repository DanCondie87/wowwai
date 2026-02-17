"use client";

import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { Doc, Id } from "../../../convex/_generated/dataModel";
import { type ColumnDef, type TaskStatus } from "@/lib/columns";
import { Button } from "@/components/ui/button";
import { SortableTaskCard } from "./sortable-task-card";
import { SwipeableTaskCard } from "./swipeable-task-card";
import { cn } from "@/lib/utils";

interface KanbanColumnProps {
  column: ColumnDef;
  tasks: Doc<"tasks">[];
  allTasks: Doc<"tasks">[];
  projects: Doc<"projects">[];
  onAddTask?: (status: TaskStatus) => void;
  onCardClick?: (taskId: string) => void;
  isOver?: boolean;
  isMobile?: boolean;
  selectedCardId?: Id<"tasks"> | null;
}

export function KanbanColumn({
  column,
  tasks,
  allTasks,
  projects,
  onAddTask,
  onCardClick,
  isOver,
  isMobile,
  selectedCardId,
}: KanbanColumnProps) {
  const { setNodeRef } = useDroppable({
    id: `column-${column.id}`,
    data: { type: "column", status: column.id },
  });

  const projectMap = new Map(projects.map((p) => [p._id, p]));

  function getSubtaskCounts(taskId: string) {
    const subtasks = allTasks.filter((t) => t.parentTaskId === taskId);
    return {
      total: subtasks.length,
      done: subtasks.filter((t) => t.status === "done").length,
    };
  }

  // Only show top-level tasks (no parentTaskId) in the columns
  const topLevelTasks = tasks.filter((t) => !t.parentTaskId);
  const taskIds = topLevelTasks.map((t) => t._id);

  return (
    <div
      className={cn(
        "flex w-72 flex-shrink-0 flex-col rounded-lg bg-muted/50 transition-colors lg:w-72",
        isOver && "ring-2 ring-primary/30 bg-muted/80"
      )}
    >
      {/* Column header */}
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground">
            {column.label}
          </h3>
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-xs font-medium text-muted-foreground">
            {topLevelTasks.length}
          </span>
        </div>
      </div>

      {/* Card list */}
      <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className="flex-1 space-y-2 overflow-y-auto px-2 pb-2 min-h-[60px]"
        >
          {topLevelTasks.length === 0 && (
            <p className="py-8 text-center text-xs text-muted-foreground">
              No tasks yet
            </p>
          )}
          {topLevelTasks.map((task) => {
            const counts = getSubtaskCounts(task._id);
            const isSelected = selectedCardId === task._id;
            return isMobile ? (
              <SwipeableTaskCard
                key={task._id}
                task={task}
                project={projectMap.get(task.projectId)}
                subtaskCount={counts.total}
                subtaskDoneCount={counts.done}
                onClick={() => onCardClick?.(task._id)}
              />
            ) : (
              <div
                key={task._id}
                className={cn(
                  "rounded-md",
                  isSelected && "ring-2 ring-primary"
                )}
              >
                <SortableTaskCard
                  task={task}
                  project={projectMap.get(task.projectId)}
                  subtaskCount={counts.total}
                  subtaskDoneCount={counts.done}
                  onClick={() => onCardClick?.(task._id)}
                />
              </div>
            );
          })}
        </div>
      </SortableContext>

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
