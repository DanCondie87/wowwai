"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface AgentActivityIndicatorProps {
  taskId: Id<"tasks">;
}

function getRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

export function AgentActivityIndicator({ taskId }: AgentActivityIndicatorProps) {
  const activity = useQuery(api.agentActivity.getActiveByTaskId, { taskId });

  if (!activity) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center" aria-label="AI agent is working">
            <span className="relative flex h-5 w-5 items-center justify-center">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/40" />
              <span className="text-sm">&#x1F988;</span>
            </span>
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <p className="font-medium">Dali is working</p>
          <p className="text-muted-foreground">Model: {activity.model}</p>
          {activity.currentAction && (
            <p className="text-muted-foreground">{activity.currentAction}</p>
          )}
          <p className="text-muted-foreground">
            Started {getRelativeTime(activity.startedAt)}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
