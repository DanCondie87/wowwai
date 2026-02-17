"use client";

import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Doc, Id } from "../../../convex/_generated/dataModel";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SubtaskList, BackToParent } from "./subtask-list";
import { AuditTrail } from "./audit-trail";

interface CardDetailSheetProps {
  taskId: Id<"tasks"> | null;
  onClose: () => void;
  onNavigate?: (taskId: Id<"tasks">) => void;
  projects: Doc<"projects">[];
}

type TaskPriority = "low" | "medium" | "high" | "urgent";
type TaskAssignee = "dan" | "dali";

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-green-500",
  medium: "bg-blue-500",
  high: "bg-orange-500",
  urgent: "bg-red-500",
};

export function CardDetailSheet({
  taskId,
  onClose,
  onNavigate,
  projects,
}: CardDetailSheetProps) {
  const taskData = useQuery(
    api.tasks.getById,
    taskId ? { id: taskId } : "skip"
  );
  const updateTask = useMutation(api.tasks.update);
  const [savedMessage, setSavedMessage] = useState(false);

  const task = taskData
    ? { ...taskData, subtasks: taskData.subtasks }
    : null;

  const showSaved = useCallback(() => {
    setSavedMessage(true);
    const timeout = setTimeout(() => setSavedMessage(false), 1500);
    return () => clearTimeout(timeout);
  }, []);

  async function handleFieldBlur(
    field: string,
    value: string | string[] | undefined
  ) {
    if (!taskId || !task) return;

    const currentValue = (task as Record<string, unknown>)[field];
    if (JSON.stringify(currentValue) === JSON.stringify(value)) return;

    await updateTask({ id: taskId, [field]: value });
    showSaved();
  }

  async function handleSelectChange(
    field: string,
    value: string
  ) {
    if (!taskId) return;
    await updateTask({ id: taskId, [field]: value });
    showSaved();
  }

  const projectMap = new Map(projects.map((p) => [p._id, p]));
  const project = task ? projectMap.get(task.projectId) : undefined;

  return (
    <Sheet open={!!taskId} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg overflow-y-auto"
      >
        {task ? (
          <>
            <SheetHeader>
              {task.parentTaskId && onNavigate && (
                <BackToParent
                  parentTaskId={task.parentTaskId}
                  onNavigate={onNavigate}
                />
              )}
              <div className="flex items-center gap-2">
                {project && (
                  <span
                    className="inline-block h-3 w-3 rounded-full"
                    style={{ backgroundColor: project.color }}
                  />
                )}
                <SheetDescription className="font-mono text-xs">
                  {task.cardId}
                </SheetDescription>
                {savedMessage && (
                  <span className="text-xs text-green-600">Saved</span>
                )}
              </div>
              <EditableTitle
                value={task.title}
                onSave={(v) => handleFieldBlur("title", v)}
              />
            </SheetHeader>

            <div className="space-y-6 px-4 pb-8">
              {/* Status + Priority + Assignee row */}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Status
                  </label>
                  <Badge variant="secondary" className="w-fit">
                    {task.status}
                  </Badge>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Assignee
                  </label>
                  <Select
                    value={task.assignee}
                    onValueChange={(v) => handleSelectChange("assignee", v)}
                  >
                    <SelectTrigger className="h-8 w-full" size="sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dali">{"\u{1F988}"} Dali</SelectItem>
                      <SelectItem value="dan">{"\u{1F464}"} Dan</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Priority
                  </label>
                  <Select
                    value={task.priority}
                    onValueChange={(v) => handleSelectChange("priority", v)}
                  >
                    <SelectTrigger className="h-8 w-full" size="sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">
                        <div className="flex items-center gap-2">
                          <span className={`h-2 w-2 rounded-full ${PRIORITY_COLORS.low}`} />
                          Low
                        </div>
                      </SelectItem>
                      <SelectItem value="medium">
                        <div className="flex items-center gap-2">
                          <span className={`h-2 w-2 rounded-full ${PRIORITY_COLORS.medium}`} />
                          Medium
                        </div>
                      </SelectItem>
                      <SelectItem value="high">
                        <div className="flex items-center gap-2">
                          <span className={`h-2 w-2 rounded-full ${PRIORITY_COLORS.high}`} />
                          High
                        </div>
                      </SelectItem>
                      <SelectItem value="urgent">
                        <div className="flex items-center gap-2">
                          <span className={`h-2 w-2 rounded-full ${PRIORITY_COLORS.urgent}`} />
                          Urgent
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Blocked indicator */}
              {task.blockedBy.length > 0 && (
                <Badge variant="destructive">BLOCKED</Badge>
              )}

              {/* Description */}
              <EditableTextarea
                label="Description"
                value={task.description ?? ""}
                onSave={(v) => handleFieldBlur("description", v || undefined)}
                placeholder="Add a description..."
              />

              {/* Tags */}
              <EditableTags
                tags={task.tags}
                onSave={(tags) => handleFieldBlur("tags", tags)}
              />

              {/* Definition of Done */}
              <EditableTextarea
                label="Definition of Done"
                value={task.definitionOfDone ?? ""}
                onSave={(v) => handleFieldBlur("definitionOfDone", v || undefined)}
                placeholder="What does done look like?"
              />

              {/* Testing Criteria */}
              <EditableTextarea
                label="Testing Criteria"
                value={task.testingCriteria ?? ""}
                onSave={(v) => handleFieldBlur("testingCriteria", v || undefined)}
                placeholder="How to verify this works?"
              />

              {/* Figma Link */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Figma Link
                </label>
                <EditableField
                  value={task.figmaLink ?? ""}
                  onSave={(v) => handleFieldBlur("figmaLink", v || undefined)}
                  placeholder="Paste Figma URL..."
                  type="url"
                />
              </div>

              {/* Subtasks — US-016 */}
              <SubtaskList
                taskId={taskId!}
                subtasks={task.subtasks}
                projectId={task.projectId}
                onOpenSubtask={onNavigate}
              />

              {/* Audit Trail — US-017 */}
              <AuditTrail taskId={taskId!} />
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center p-8">
            <p className="text-muted-foreground">Loading task...</p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

// --- Inline editable sub-components ---

function EditableTitle({
  value,
  onSave,
}: {
  value: string;
  onSave: (value: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  if (!editing) {
    return (
      <SheetTitle
        className="cursor-pointer hover:bg-accent/50 rounded px-1 -mx-1 text-lg"
        onClick={() => setEditing(true)}
      >
        {value}
      </SheetTitle>
    );
  }

  return (
    <Input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        setEditing(false);
        if (draft.trim() && draft !== value) onSave(draft.trim());
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          setEditing(false);
          if (draft.trim() && draft !== value) onSave(draft.trim());
        }
        if (e.key === "Escape") {
          setEditing(false);
          setDraft(value);
        }
      }}
      autoFocus
      className="text-lg font-semibold"
    />
  );
}

function EditableField({
  value,
  onSave,
  placeholder,
  type = "text",
}: {
  value: string;
  onSave: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  return (
    <Input
      type={type}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== value) onSave(draft);
      }}
      placeholder={placeholder}
      className="h-8 text-sm"
    />
  );
}

function EditableTextarea({
  label,
  value,
  onSave,
  placeholder,
}: {
  label: string;
  value: string;
  onSave: (value: string) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <Textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft !== value) onSave(draft);
        }}
        placeholder={placeholder}
        rows={3}
        className="text-sm"
      />
    </div>
  );
}

function EditableTags({
  tags,
  onSave,
}: {
  tags: string[];
  onSave: (tags: string[]) => void;
}) {
  const [draft, setDraft] = useState(tags.join(", "));

  useEffect(() => {
    setDraft(tags.join(", "));
  }, [tags]);

  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">
        Tags
      </label>
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const newTags = draft
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean);
          if (JSON.stringify(newTags) !== JSON.stringify(tags)) {
            onSave(newTags);
          }
        }}
        placeholder="Comma-separated tags"
        className="h-8 text-sm"
      />
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
