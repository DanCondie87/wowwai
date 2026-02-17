"use client";

import { Doc } from "../../../convex/_generated/dataModel";
import { cn } from "@/lib/utils";

interface TaskCardProps {
  task: Doc<"tasks">;
  project?: Doc<"projects">;
  onClick?: () => void;
  isDragging?: boolean;
}

export function TaskCard({ task, project, onClick, isDragging }: TaskCardProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClick?.();
      }}
      className={cn(
        "group relative cursor-pointer rounded-md border bg-card p-3 shadow-sm transition-all hover:shadow-md",
        isDragging && "opacity-50 shadow-lg"
      )}
    >
      {/* Project color strip */}
      {project && (
        <div
          className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-md"
          style={{ backgroundColor: project.color }}
        />
      )}

      <div className="pl-2">
        {/* Card ID */}
        <p className="text-xs text-muted-foreground">{task.cardId}</p>

        {/* Title */}
        <p className="mt-0.5 text-sm font-medium text-foreground line-clamp-2">
          {task.title}
        </p>
      </div>
    </div>
  );
}
