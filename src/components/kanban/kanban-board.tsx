"use client";

import { useState } from "react";
import { Doc } from "../../../convex/_generated/dataModel";
import { COLUMNS, type TaskStatus } from "@/lib/columns";
import { KanbanColumn } from "./kanban-column";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface KanbanBoardProps {
  projects: Doc<"projects">[];
  tasks: Doc<"tasks">[];
  isLoading: boolean;
}

export function KanbanBoard({ projects, tasks, isLoading }: KanbanBoardProps) {
  const [selectedProjectId, setSelectedProjectId] = useState<string>("all");
  const [activeColumnIndex, setActiveColumnIndex] = useState(0);

  const filteredTasks =
    selectedProjectId === "all"
      ? tasks
      : tasks.filter((t) => t.projectId === selectedProjectId);

  const tasksByStatus = (status: TaskStatus) =>
    filteredTasks
      .filter((t) => t.status === status)
      .sort((a, b) => a.position - b.position);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-muted-foreground">Loading board...</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Filter bar */}
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All Projects" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Projects</SelectItem>
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

      {/* Mobile column tabs */}
      <div className="flex border-b lg:hidden overflow-x-auto">
        {COLUMNS.map((col, idx) => (
          <button
            key={col.id}
            onClick={() => setActiveColumnIndex(idx)}
            className={cn(
              "flex-shrink-0 px-4 py-2 text-sm font-medium border-b-2 transition-colors",
              idx === activeColumnIndex
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {col.label}
            <span className="ml-1.5 text-xs text-muted-foreground">
              {tasksByStatus(col.id).length}
            </span>
          </button>
        ))}
      </div>

      {/* Desktop: horizontal scroll with all columns */}
      <div className="hidden lg:flex flex-1 gap-4 overflow-x-auto p-4">
        {COLUMNS.map((col) => (
          <KanbanColumn
            key={col.id}
            column={col}
            tasks={tasksByStatus(col.id)}
            allTasks={filteredTasks}
            projects={projects}
          />
        ))}
      </div>

      {/* Mobile: single column view */}
      <div className="flex-1 overflow-auto p-4 lg:hidden">
        <KanbanColumn
          column={COLUMNS[activeColumnIndex]}
          tasks={tasksByStatus(COLUMNS[activeColumnIndex].id)}
          allTasks={filteredTasks}
          projects={projects}
        />
      </div>
    </div>
  );
}
