"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface AuditTrailProps {
  taskId: Id<"tasks">;
}

const STATUS_LABEL: Record<string, string> = {
  backlog: "Backlog",
  todo: "To Do",
  "in-progress": "In Progress",
  review: "Review",
  done: "Done",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  backlog: "outline",
  todo: "secondary",
  "in-progress": "default",
  review: "default",
  done: "secondary",
};

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

function formatActionDescription(
  actor: string,
  action: string,
  before?: string,
  after?: string
): { text: string; showStatusChange: boolean; oldStatus?: string; newStatus?: string } {
  const actorName = actor === "dali" ? "Dali" : actor === "dan" ? "Dan" : "System";

  if (action === "created") {
    return { text: `${actorName} created this task`, showStatusChange: false };
  }

  if (action === "moved" && before && after) {
    return {
      text: `${actorName} moved this`,
      showStatusChange: true,
      oldStatus: before,
      newStatus: after,
    };
  }

  if (action.startsWith("updated ")) {
    const field = action.replace("updated ", "");
    const fieldLabels: Record<string, string> = {
      title: "title",
      description: "description",
      assignee: "assignee",
      priority: "priority",
      tags: "tags",
      status: "status",
      definitionOfDone: "definition of done",
      testingCriteria: "testing criteria",
      figmaLink: "Figma link",
      sessionSummary: "session summary",
      blockedBy: "blockers",
      modelUsed: "model",
    };
    const label = fieldLabels[field] ?? field;
    return { text: `${actorName} updated ${label}`, showStatusChange: false };
  }

  return { text: `${actorName} ${action}`, showStatusChange: false };
}

export function AuditTrail({ taskId }: AuditTrailProps) {
  const logs = useQuery(api.auditLogs.getByTask, { taskId });

  if (!logs || logs.length === 0) {
    return (
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">
          Activity
        </label>
        <p className="text-xs text-muted-foreground">No activity yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-muted-foreground">
        Activity
      </label>
      <Separator />
      <div className="space-y-3">
        {logs.map((log) => {
          const { text, showStatusChange, oldStatus, newStatus } =
            formatActionDescription(log.actor, log.action, log.before, log.after);

          return (
            <div key={log._id} className="flex gap-2 text-sm">
              {/* Actor avatar */}
              <span className="mt-0.5 shrink-0 text-sm">
                {log.actor === "dali"
                  ? "\u{1F988}"
                  : log.actor === "dan"
                    ? "\u{1F464}"
                    : "\u{2699}\u{FE0F}"}
              </span>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-foreground">{text}</span>
                  {showStatusChange && oldStatus && newStatus && (
                    <span className="flex items-center gap-1">
                      <Badge
                        variant={STATUS_VARIANT[oldStatus] ?? "outline"}
                        className="text-[10px] px-1.5 py-0"
                      >
                        {STATUS_LABEL[oldStatus] ?? oldStatus}
                      </Badge>
                      <span className="text-xs text-muted-foreground">&rarr;</span>
                      <Badge
                        variant={STATUS_VARIANT[newStatus] ?? "outline"}
                        className="text-[10px] px-1.5 py-0"
                      >
                        {STATUS_LABEL[newStatus] ?? newStatus}
                      </Badge>
                    </span>
                  )}
                </div>

                {/* Comment text */}
                {log.comment && (
                  <p className="mt-1 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground italic">
                    {log.comment}
                  </p>
                )}

                {/* Model used badge */}
                {log.modelUsed && (
                  <span className="mt-0.5 inline-block text-[10px] text-muted-foreground">
                    via {log.modelUsed}
                  </span>
                )}

                {/* Timestamp */}
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {formatRelativeTime(log.timestamp)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
