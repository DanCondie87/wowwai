"use client";

import { useState, useRef, type TouchEvent } from "react";
import { toast } from "sonner";
import { Doc } from "../../../convex/_generated/dataModel";
import { useAuthMutation } from "@/lib/use-auth-mutation";
import { COLUMNS, type TaskStatus } from "@/lib/columns";
import { TaskCard } from "./task-card";
import { cn } from "@/lib/utils";

interface SwipeableTaskCardProps {
  task: Doc<"tasks">;
  project?: Doc<"projects">;
  subtaskCount?: number;
  subtaskDoneCount?: number;
  onClick?: () => void;
}

const SWIPE_THRESHOLD = 80;

export function SwipeableTaskCard({
  task,
  project,
  subtaskCount,
  subtaskDoneCount,
  onClick,
}: SwipeableTaskCardProps) {
  const [offset, setOffset] = useState(0);
  const startX = useRef(0);
  const startY = useRef(0);
  const isHorizontal = useRef<boolean | null>(null);
  const moveToColumn = useAuthMutation<Record<string, unknown>>("tasks.moveToColumn");

  const columnIndex = COLUMNS.findIndex((c) => c.id === task.status);

  function getAdjacentStatus(direction: "next" | "prev"): TaskStatus | null {
    const nextIndex = direction === "next" ? columnIndex + 1 : columnIndex - 1;
    if (nextIndex < 0 || nextIndex >= COLUMNS.length) return null;
    return COLUMNS[nextIndex].id;
  }

  function handleTouchStart(e: TouchEvent) {
    const touch = e.touches[0];
    startX.current = touch.clientX;
    startY.current = touch.clientY;
    isHorizontal.current = null;
  }

  function handleTouchMove(e: TouchEvent) {
    const touch = e.touches[0];
    const dx = touch.clientX - startX.current;
    const dy = touch.clientY - startY.current;

    if (isHorizontal.current === null && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
      isHorizontal.current = Math.abs(dx) > Math.abs(dy);
    }

    if (isHorizontal.current) {
      // Clamp the offset
      const clamped = Math.max(-120, Math.min(120, dx));
      setOffset(clamped);
    }
  }

  async function handleTouchEnd() {
    if (Math.abs(offset) >= SWIPE_THRESHOLD) {
      const direction = offset > 0 ? "next" : "prev";
      const targetStatus = getAdjacentStatus(direction);

      if (targetStatus) {
        try {
          await moveToColumn({
            id: task._id,
            status: targetStatus,
            position: 0,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Failed to move task";
          toast.error(message);
        }
      }
    }

    setOffset(0);
    isHorizontal.current = null;
  }

  const showSwipeRight = offset > SWIPE_THRESHOLD / 2;
  const showSwipeLeft = offset < -SWIPE_THRESHOLD / 2;

  return (
    <div className="relative overflow-hidden rounded-md lg:hidden">
      {/* Swipe background indicators */}
      {showSwipeRight && (
        <div className="absolute inset-0 flex items-center justify-start bg-green-500/20 pl-3 rounded-md">
          <span className="text-green-600 text-sm font-medium">
            → {getAdjacentStatus("next") ?? ""}
          </span>
        </div>
      )}
      {showSwipeLeft && (
        <div className="absolute inset-0 flex items-center justify-end bg-orange-500/20 pr-3 rounded-md">
          <span className="text-orange-600 text-sm font-medium">
            {getAdjacentStatus("prev") ?? ""} ←
          </span>
        </div>
      )}

      <div
        className={cn(
          "relative transition-transform touch-pan-y",
          offset === 0 && "transition-transform duration-200"
        )}
        style={{ transform: `translateX(${offset}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <TaskCard
          task={task}
          project={project}
          subtaskCount={subtaskCount}
          subtaskDoneCount={subtaskDoneCount}
          onClick={onClick}
        />
      </div>
    </div>
  );
}
