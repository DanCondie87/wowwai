"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Doc } from "../../../convex/_generated/dataModel";
import { TaskCard } from "./task-card";

interface SortableTaskCardProps {
  task: Doc<"tasks">;
  project?: Doc<"projects">;
  subtaskCount?: number;
  subtaskDoneCount?: number;
  onClick?: () => void;
}

export function SortableTaskCard({
  task,
  project,
  subtaskCount,
  subtaskDoneCount,
  onClick,
}: SortableTaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task._id,
    data: { type: "task", task },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TaskCard
        task={task}
        project={project}
        subtaskCount={subtaskCount}
        subtaskDoneCount={subtaskDoneCount}
        onClick={onClick}
        isDragging={isDragging}
      />
    </div>
  );
}
