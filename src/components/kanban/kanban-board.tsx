"use client";

import { useState, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Doc, Id } from "../../../convex/_generated/dataModel";
import { COLUMNS, type TaskStatus } from "@/lib/columns";
import { KanbanColumn } from "./kanban-column";
import { TaskCard } from "./task-card";
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
  onAddTask?: (status: TaskStatus) => void;
  onCardClick?: (taskId: Id<"tasks">) => void;
}

export function KanbanBoard({
  projects,
  tasks,
  isLoading,
  onAddTask,
  onCardClick,
}: KanbanBoardProps) {
  const [selectedProjectId, setSelectedProjectId] = useState<string>("all");
  const [activeColumnIndex, setActiveColumnIndex] = useState(0);
  const [activeTask, setActiveTask] = useState<Doc<"tasks"> | null>(null);
  const [overColumnId, setOverColumnId] = useState<string | null>(null);

  const moveToColumn = useMutation(api.tasks.moveToColumn);
  const reorder = useMutation(api.tasks.reorder);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    })
  );

  const filteredTasks =
    selectedProjectId === "all"
      ? tasks
      : tasks.filter((t) => t.projectId === selectedProjectId);

  const tasksByStatus = useCallback(
    (status: TaskStatus) =>
      filteredTasks
        .filter((t) => t.status === status && !t.parentTaskId)
        .sort((a, b) => a.position - b.position),
    [filteredTasks]
  );

  const projectMap = new Map(projects.map((p) => [p._id, p]));

  function findColumnForTask(taskId: string): TaskStatus | null {
    const task = filteredTasks.find((t) => t._id === taskId);
    return task ? task.status : null;
  }

  function handleDragStart(event: DragStartEvent) {
    const task = filteredTasks.find((t) => t._id === event.active.id);
    if (task) setActiveTask(task);
  }

  function handleDragOver(event: DragOverEvent) {
    const { over } = event;
    if (!over) {
      setOverColumnId(null);
      return;
    }

    // Check if hovering over a column droppable
    const overData = over.data.current;
    if (overData?.type === "column") {
      setOverColumnId(overData.status as string);
    } else if (overData?.type === "task") {
      // Hovering over a task — find which column it's in
      const col = findColumnForTask(over.id as string);
      setOverColumnId(col);
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveTask(null);
    setOverColumnId(null);

    if (!over) return;

    const activeId = active.id as Id<"tasks">;
    const sourceColumn = findColumnForTask(activeId);
    if (!sourceColumn) return;

    let targetColumn: TaskStatus;
    const overData = over.data.current;

    if (overData?.type === "column") {
      targetColumn = overData.status as TaskStatus;
    } else if (overData?.type === "task") {
      const targetTask = filteredTasks.find((t) => t._id === over.id);
      if (!targetTask) return;
      targetColumn = targetTask.status;
    } else {
      return;
    }

    const targetTasks = tasksByStatus(targetColumn);

    if (sourceColumn === targetColumn) {
      // Reorder within same column
      const activeIndex = targetTasks.findIndex((t) => t._id === activeId);
      const overIndex = overData?.type === "task"
        ? targetTasks.findIndex((t) => t._id === over.id)
        : targetTasks.length;

      if (activeIndex !== overIndex && overIndex >= 0) {
        await reorder({ id: activeId, position: overIndex });
      }
    } else {
      // Move to different column
      const overIndex = overData?.type === "task"
        ? targetTasks.findIndex((t) => t._id === over.id)
        : targetTasks.length;

      await moveToColumn({
        id: activeId,
        status: targetColumn,
        position: Math.max(0, overIndex),
      });
    }
  }

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

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        {/* Desktop: horizontal scroll with all columns */}
        <div className="hidden lg:flex flex-1 gap-4 overflow-x-auto p-4">
          {COLUMNS.map((col) => (
            <KanbanColumn
              key={col.id}
              column={col}
              tasks={filteredTasks.filter((t) => t.status === col.id).sort((a, b) => a.position - b.position)}
              allTasks={filteredTasks}
              projects={projects}
              onAddTask={onAddTask}
              onCardClick={(id) => onCardClick?.(id as Id<"tasks">)}
              isOver={overColumnId === col.id}
            />
          ))}
        </div>

        {/* Mobile: single column view */}
        <div className="flex-1 overflow-auto p-4 lg:hidden">
          <KanbanColumn
            column={COLUMNS[activeColumnIndex]}
            tasks={filteredTasks
              .filter((t) => t.status === COLUMNS[activeColumnIndex].id)
              .sort((a, b) => a.position - b.position)}
            allTasks={filteredTasks}
            projects={projects}
            onAddTask={onAddTask}
            onCardClick={(id) => onCardClick?.(id as Id<"tasks">)}
            isOver={overColumnId === COLUMNS[activeColumnIndex].id}
          />
        </div>

        {/* Drag overlay — shows ghost of card being dragged */}
        <DragOverlay>
          {activeTask && (
            <div className="rotate-2 opacity-90">
              <TaskCard
                task={activeTask}
                project={projectMap.get(activeTask.projectId)}
              />
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
