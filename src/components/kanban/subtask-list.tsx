"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Doc, Id } from "../../../convex/_generated/dataModel";
import { useAuthMutation } from "@/lib/use-auth-mutation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, ArrowLeft } from "lucide-react";

interface SubtaskListProps {
  taskId: Id<"tasks">;
  subtasks: Doc<"tasks">[];
  projectId: Id<"projects">;
  onOpenSubtask?: (subtaskId: Id<"tasks">) => void;
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  backlog: "outline",
  todo: "secondary",
  "in-progress": "default",
  review: "default",
  done: "secondary",
};

const STATUS_LABEL: Record<string, string> = {
  backlog: "Backlog",
  todo: "To Do",
  "in-progress": "In Progress",
  review: "Review",
  done: "Done",
};

export function SubtaskList({
  taskId,
  subtasks,
  projectId,
  onOpenSubtask,
}: SubtaskListProps) {
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [assignee, setAssignee] = useState<"dan" | "dali">("dali");
  const [isCreating, setIsCreating] = useState(false);

  const createTask = useAuthMutation<Record<string, unknown>>("tasks.create");

  const doneCount = subtasks.filter((s) => s.status === "done").length;
  const totalCount = subtasks.length;

  async function handleAddSubtask() {
    if (!title.trim()) return;
    setIsCreating(true);
    try {
      await createTask({
        projectId,
        title: title.trim(),
        assignee,
        priority: "medium",
        status: "todo",
        parentTaskId: taskId,
      });
      setTitle("");
      setShowForm(false);
      toast.success("Subtask added");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to add subtask";
      toast.error(message);
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-muted-foreground">
          Subtasks
          {totalCount > 0 && (
            <span className="ml-1">
              ({doneCount}/{totalCount})
            </span>
          )}
        </label>
      </div>

      {/* Progress bar */}
      {totalCount > 0 && (
        <div className="h-1.5 w-full rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{
              width: `${(doneCount / totalCount) * 100}%`,
            }}
          />
        </div>
      )}

      {/* Subtask list */}
      {subtasks.length > 0 && (
        <div className="space-y-1">
          {subtasks.map((subtask) => (
            <button
              key={subtask._id}
              onClick={() => onOpenSubtask?.(subtask._id)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent transition-colors"
            >
              <span className="flex-1 truncate">{subtask.title}</span>
              <Badge
                variant={STATUS_VARIANT[subtask.status] ?? "secondary"}
                className="text-[10px] px-1.5 py-0 shrink-0"
              >
                {STATUS_LABEL[subtask.status] ?? subtask.status}
              </Badge>
              <span className="text-xs shrink-0" title={`Assigned to ${subtask.assignee}`}>
                {subtask.assignee === "dali" ? "\u{1F988}" : "\u{1F464}"}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Add subtask form */}
      {showForm ? (
        <div className="space-y-2 rounded-md border p-2">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Subtask title..."
            className="h-8 text-sm"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAddSubtask();
              if (e.key === "Escape") {
                setShowForm(false);
                setTitle("");
              }
            }}
          />
          <div className="flex items-center gap-2">
            <Select
              value={assignee}
              onValueChange={(v) => setAssignee(v as "dan" | "dali")}
            >
              <SelectTrigger className="h-8 w-32" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dali">{"\u{1F988}"} Dali</SelectItem>
                <SelectItem value="dan">{"\u{1F464}"} Dan</SelectItem>
              </SelectContent>
            </Select>
            <div className="ml-auto flex gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setShowForm(false);
                  setTitle("");
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleAddSubtask}
                disabled={!title.trim() || isCreating}
              >
                Add
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground"
          onClick={() => setShowForm(true)}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add subtask
        </Button>
      )}
    </div>
  );
}

// Back to parent link component for subtask detail views
export function BackToParent({
  parentTaskId,
  onNavigate,
}: {
  parentTaskId: Id<"tasks">;
  onNavigate: (id: Id<"tasks">) => void;
}) {
  return (
    <button
      onClick={() => onNavigate(parentTaskId)}
      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
    >
      <ArrowLeft className="h-3 w-3" />
      Back to parent
    </button>
  );
}
