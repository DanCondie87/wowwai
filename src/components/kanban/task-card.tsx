"use client";

import { Doc } from "../../../convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { cn, getTagColor } from "@/lib/utils";
import { AgentActivityIndicator } from "./agent-activity-indicator";

interface TaskCardProps {
  task: Doc<"tasks">;
  project?: Doc<"projects">;
  subtaskCount?: number;
  subtaskDoneCount?: number;
  onClick?: () => void;
  isDragging?: boolean;
}

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-green-500",
  medium: "bg-blue-500",
  high: "bg-orange-500",
  urgent: "bg-red-500",
};

function getStalenessColor(lastTouchedAt: number): string {
  const hoursAgo = (Date.now() - lastTouchedAt) / (1000 * 60 * 60);
  if (hoursAgo < 24) return "bg-green-500";
  if (hoursAgo < 72) return "bg-yellow-500";
  if (hoursAgo < 168) return "bg-orange-500";
  return "bg-red-500";
}

function getStalenessLabel(lastTouchedAt: number): string {
  const hoursAgo = (Date.now() - lastTouchedAt) / (1000 * 60 * 60);
  if (hoursAgo < 24) return "Active today";
  if (hoursAgo < 72) return "1-3 days ago";
  if (hoursAgo < 168) return "3-7 days ago";
  return "Over a week ago";
}

export function TaskCard({
  task,
  project,
  subtaskCount = 0,
  subtaskDoneCount = 0,
  onClick,
  isDragging,
}: TaskCardProps) {
  const isBlocked = task.blockedBy.length > 0;
  const maxVisibleTags = 3;
  const visibleTags = task.tags.slice(0, maxVisibleTags);
  const overflowCount = task.tags.length - maxVisibleTags;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClick?.();
      }}
      className={cn(
        "group relative cursor-pointer rounded-md border bg-card p-3 shadow-sm transition-all hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        isDragging && "opacity-50 shadow-lg rotate-2"
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
        {/* Top row: card ID + staleness + priority */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{task.cardId}</p>
          <div className="flex items-center gap-1.5">
            {/* Staleness indicator */}
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                getStalenessColor(task.lastTouchedAt)
              )}
              title={getStalenessLabel(task.lastTouchedAt)}
            />
            {/* Priority dot */}
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                PRIORITY_COLORS[task.priority]
              )}
              title={`Priority: ${task.priority}`}
            />
          </div>
        </div>

        {/* Title */}
        <p className="mt-1 text-sm font-medium text-foreground line-clamp-2">
          {task.title}
        </p>

        {/* Tags */}
        {task.tags.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {visibleTags.map((tag) => {
              const color = getTagColor(tag);
              return (
                <span
                  key={tag}
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-medium",
                    color.bg,
                    color.text
                  )}
                >
                  {tag}
                </span>
              );
            })}
            {overflowCount > 0 && (
              <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                +{overflowCount}
              </span>
            )}
          </div>
        )}

        {/* Subtask progress bar */}
        {subtaskCount > 0 && (
          <div className="mt-2">
            <div className="h-1.5 w-full rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{
                  width: `${(subtaskDoneCount / subtaskCount) * 100}%`,
                }}
              />
            </div>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              {subtaskDoneCount}/{subtaskCount} subtasks
            </p>
          </div>
        )}

        {/* Bottom row: blocked badge + AI activity + assignee */}
        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center gap-1">
            {isBlocked ? (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                BLOCKED
              </Badge>
            ) : (
              <span />
            )}
          </div>
          <div className="flex items-center gap-1">
            <AgentActivityIndicator taskId={task._id} />
            <span className="text-sm" title={`Assigned to ${task.assignee}`}>
              {task.assignee === "dali" ? "\u{1F988}" : "\u{1F464}"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
