"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, X } from "lucide-react";

interface BlockerListProps {
  taskId: Id<"tasks">;
  blockedBy: Id<"tasks">[];
  projectId: Id<"projects">;
  onNavigate?: (taskId: Id<"tasks">) => void;
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

export function BlockerList({
  taskId,
  blockedBy,
  projectId,
  onNavigate,
}: BlockerListProps) {
  const [showPicker, setShowPicker] = useState(false);
  const projectTasks = useQuery(api.tasks.getByProject, { projectId });
  const updateTask = useMutation(api.tasks.update);

  // Resolve blocker task details
  const blockerDetails = (projectTasks ?? []).filter((t) =>
    blockedBy.includes(t._id)
  );

  // Available tasks to add as blockers (exclude self and already-blocked)
  const availableTasks = (projectTasks ?? []).filter(
    (t) => t._id !== taskId && !blockedBy.includes(t._id) && !t.parentTaskId
  );

  async function handleAddBlocker(blockerId: string) {
    const newBlockedBy = [...blockedBy, blockerId as Id<"tasks">];
    await updateTask({ id: taskId, blockedBy: newBlockedBy });
    setShowPicker(false);
  }

  async function handleRemoveBlocker(blockerId: Id<"tasks">) {
    const newBlockedBy = blockedBy.filter((id) => id !== blockerId);
    await updateTask({ id: taskId, blockedBy: newBlockedBy });
  }

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-muted-foreground">
        Blocked By
        {blockedBy.length > 0 && (
          <span className="ml-1">({blockedBy.length})</span>
        )}
      </label>

      {/* Blocker list */}
      {blockerDetails.length > 0 && (
        <div className="space-y-1">
          {blockerDetails.map((blocker) => (
            <div
              key={blocker._id}
              className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm"
            >
              <button
                onClick={() => onNavigate?.(blocker._id)}
                className="flex flex-1 items-center gap-2 text-left hover:underline min-w-0"
              >
                <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                  {blocker.cardId}
                </span>
                <span className="truncate">{blocker.title}</span>
              </button>
              <Badge
                variant={STATUS_VARIANT[blocker.status] ?? "secondary"}
                className="text-[10px] px-1.5 py-0 shrink-0"
              >
                {STATUS_LABEL[blocker.status] ?? blocker.status}
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 shrink-0"
                onClick={() => handleRemoveBlocker(blocker._id)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Add blocker picker */}
      {showPicker ? (
        <div className="space-y-2 rounded-md border p-2">
          <Select onValueChange={handleAddBlocker}>
            <SelectTrigger className="h-8" size="sm">
              <SelectValue placeholder="Select a task..." />
            </SelectTrigger>
            <SelectContent>
              {availableTasks.length === 0 ? (
                <div className="px-2 py-1.5 text-xs text-muted-foreground">
                  No tasks available
                </div>
              ) : (
                availableTasks.map((t) => (
                  <SelectItem key={t._id} value={t._id}>
                    <span className="font-mono text-[10px] text-muted-foreground mr-1">
                      {t.cardId}
                    </span>
                    {t.title}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowPicker(false)}
          >
            Cancel
          </Button>
        </div>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground"
          onClick={() => setShowPicker(true)}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add blocker
        </Button>
      )}
    </div>
  );
}
