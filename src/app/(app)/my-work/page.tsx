"use client";

import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Doc, Id } from "../../../../convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CardDetailSheet } from "@/components/kanban/card-detail-sheet";

type SortOption = "priority" | "staleness" | "project";

const PRIORITY_ORDER: Record<string, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-green-500",
  medium: "bg-blue-500",
  high: "bg-orange-500",
  urgent: "bg-red-500",
};

const STATUS_LABEL: Record<string, string> = {
  backlog: "Backlog",
  todo: "To Do",
  "in-progress": "In Progress",
  review: "Review",
  done: "Done",
};

export default function MyWorkPage() {
  const [assigneeFilter, setAssigneeFilter] = useState<"all" | "dan" | "dali">("all");
  const [sortBy, setSortBy] = useState<SortOption>("priority");
  const [detailTaskId, setDetailTaskId] = useState<Id<"tasks"> | null>(null);

  const tasks = useQuery(
    api.tasks.getByAssignee,
    assigneeFilter === "all" ? {} : { assignee: assigneeFilter }
  );
  const projects = useQuery(api.projects.getAll);

  const projectMap = useMemo(
    () => new Map((projects ?? []).map((p) => [p._id, p])),
    [projects]
  );

  const sortedTasks = useMemo(() => {
    if (!tasks) return [];
    const sorted = [...tasks];
    switch (sortBy) {
      case "priority":
        sorted.sort(
          (a, b) => (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99)
        );
        break;
      case "staleness":
        sorted.sort((a, b) => a.lastTouchedAt - b.lastTouchedAt);
        break;
      case "project":
        sorted.sort((a, b) => {
          const pa = projectMap.get(a.projectId)?.name ?? "";
          const pb = projectMap.get(b.projectId)?.name ?? "";
          return pa.localeCompare(pb);
        });
        break;
    }
    return sorted;
  }, [tasks, sortBy, projectMap]);

  // Group tasks by project
  const groupedTasks = useMemo(() => {
    const groups = new Map<string, { project: Doc<"projects"> | undefined; tasks: Doc<"tasks">[] }>();
    for (const task of sortedTasks) {
      const key = task.projectId;
      if (!groups.has(key)) {
        groups.set(key, {
          project: projectMap.get(task.projectId),
          tasks: [],
        });
      }
      groups.get(key)!.tasks.push(task);
    }
    return Array.from(groups.values());
  }, [sortedTasks, projectMap]);

  if (tasks === undefined || projects === undefined) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
        <h2 className="text-lg font-semibold text-foreground mr-2">My Work</h2>

        {/* Assignee toggle */}
        <div className="flex rounded-md border">
          {(["all", "dan", "dali"] as const).map((val) => (
            <Button
              key={val}
              variant={assigneeFilter === val ? "default" : "ghost"}
              size="sm"
              className="rounded-none first:rounded-l-md last:rounded-r-md"
              onClick={() => setAssigneeFilter(val)}
            >
              {val === "all" ? "All" : val === "dan" ? "\u{1F464} Dan" : "\u{1F988} Dali"}
            </Button>
          ))}
        </div>

        {/* Sort */}
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
          <SelectTrigger className="w-36" size="sm">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="priority">Priority</SelectItem>
            <SelectItem value="staleness">Staleness</SelectItem>
            <SelectItem value="project">Project</SelectItem>
          </SelectContent>
        </Select>

        <span className="text-xs text-muted-foreground ml-auto">
          {sortedTasks.length} task{sortedTasks.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-auto p-4 space-y-6">
        {groupedTasks.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">No tasks to show</p>
          </div>
        )}

        {groupedTasks.map(({ project, tasks: groupTasks }) => (
          <div key={project?._id ?? "unknown"}>
            {/* Project header */}
            <div className="flex items-center gap-2 mb-2">
              {project && (
                <span
                  className="inline-block h-3 w-3 rounded-full"
                  style={{ backgroundColor: project.color }}
                />
              )}
              <h3 className="text-sm font-semibold text-foreground">
                {project?.name ?? "Unknown Project"}
              </h3>
              <span className="text-xs text-muted-foreground">
                ({groupTasks.length})
              </span>
            </div>

            {/* Task rows */}
            <div className="space-y-1">
              {groupTasks.map((task) => (
                <button
                  key={task._id}
                  onClick={() => setDetailTaskId(task._id)}
                  className="flex w-full items-center gap-3 rounded-md border bg-card px-3 py-2 text-left text-sm hover:shadow-sm transition-shadow"
                >
                  {/* Priority dot */}
                  <span
                    className={`h-2 w-2 rounded-full shrink-0 ${PRIORITY_COLORS[task.priority]}`}
                    title={`Priority: ${task.priority}`}
                  />

                  {/* Card ID */}
                  <span className="shrink-0 font-mono text-[10px] text-muted-foreground w-20">
                    {task.cardId}
                  </span>

                  {/* Title */}
                  <span className="flex-1 truncate">{task.title}</span>

                  {/* Status badge */}
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
                    {STATUS_LABEL[task.status] ?? task.status}
                  </Badge>

                  {/* Blocked */}
                  {task.blockedBy.length > 0 && (
                    <Badge variant="destructive" className="text-[10px] px-1.5 py-0 shrink-0">
                      BLOCKED
                    </Badge>
                  )}

                  {/* Assignee */}
                  <span className="text-xs shrink-0">
                    {task.assignee === "dali" ? "\u{1F988}" : "\u{1F464}"}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <CardDetailSheet
        taskId={detailTaskId}
        onClose={() => setDetailTaskId(null)}
        onNavigate={(id) => setDetailTaskId(id)}
        projects={projects ?? []}
      />
    </div>
  );
}
