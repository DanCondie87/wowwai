"use client";

import { useState, type FormEvent } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Doc, Id } from "../../../convex/_generated/dataModel";
import { type TaskStatus } from "@/lib/columns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultStatus: TaskStatus;
  projects: Doc<"projects">[];
}

export function CreateTaskDialog({
  open,
  onOpenChange,
  defaultStatus,
  projects,
}: CreateTaskDialogProps) {
  const createTask = useMutation(api.tasks.create);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState<string>("");
  const [assignee, setAssignee] = useState<"dan" | "dali">("dali");
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const [tagsInput, setTagsInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function resetForm() {
    setTitle("");
    setDescription("");
    setProjectId("");
    setAssignee("dali");
    setPriority("medium");
    setTagsInput("");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !projectId) return;

    setIsSubmitting(true);
    try {
      const tags = tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      await createTask({
        projectId: projectId as Id<"projects">,
        title: title.trim(),
        description: description.trim() || undefined,
        assignee,
        priority,
        tags,
        status: defaultStatus,
      });

      resetForm();
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Task</DialogTitle>
          <DialogDescription>
            Add a new task to the {defaultStatus.replace("-", " ")} column.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="task-title">
              Title
            </label>
            <Input
              id="task-title"
              placeholder="Task title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="task-description">
              Description
            </label>
            <Textarea
              id="task-description"
              placeholder="Optional description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Project
            </label>
            <Select value={projectId} onValueChange={setProjectId} required>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p._id} value={p._id}>
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: p.color }}
                      />
                      {p.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Assignee
              </label>
              <Select value={assignee} onValueChange={(v) => setAssignee(v as "dan" | "dali")}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dali">{"\u{1F988}"} Dali</SelectItem>
                  <SelectItem value="dan">{"\u{1F464}"} Dan</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Priority
              </label>
              <Select value={priority} onValueChange={(v) => setPriority(v as "low" | "medium" | "high" | "urgent")}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="task-tags">
              Tags
            </label>
            <Input
              id="task-tags"
              placeholder="Comma-separated tags"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !title.trim() || !projectId}>
              {isSubmitting ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
