"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import {
  LayoutDashboard,
  Workflow,
  FolderKanban,
  Plus,
  Settings,
  BarChart3,
} from "lucide-react";

interface CommandPaletteProps {
  externalOpen?: boolean;
  onExternalOpenChange?: (open: boolean) => void;
  onOpenTaskDetail?: (taskId: Id<"tasks">) => void;
  onCreateTask?: () => void;
}

const STATUS_LABEL: Record<string, string> = {
  backlog: "Backlog",
  todo: "To Do",
  "in-progress": "In Progress",
  review: "Review",
  done: "Done",
};

export function CommandPalette({
  externalOpen,
  onExternalOpenChange,
  onOpenTaskDetail,
  onCreateTask,
}: CommandPaletteProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = externalOpen ?? internalOpen;
  const setOpen = onExternalOpenChange ?? setInternalOpen;
  const [search, setSearch] = useState("");
  const router = useRouter();

  const searchResults = useQuery(
    api.search.searchTasks,
    search.trim().length > 0 ? { query: search.trim() } : "skip"
  );

  // Keyboard shortcut: Cmd+K / Ctrl+K
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(!open);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, setOpen]);

  const handleSelect = useCallback(
    (value: string) => {
      setOpen(false);
      setSearch("");

      // Navigation commands
      if (value === "go-board") {
        router.push("/board");
        return;
      }
      if (value === "go-workflows") {
        router.push("/workflows");
        return;
      }
      if (value === "go-my-work") {
        router.push("/my-work");
        return;
      }
      if (value === "go-analytics") {
        router.push("/analytics");
        return;
      }
      if (value === "go-settings") {
        router.push("/settings");
        return;
      }
      if (value === "create-task") {
        onCreateTask?.();
        return;
      }

      // Task navigation
      if (value.startsWith("task:")) {
        const taskId = value.replace("task:", "") as Id<"tasks">;
        onOpenTaskDetail?.(taskId);
      }
    },
    [router, onOpenTaskDetail, onCreateTask]
  );

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Search tasks or type a command..."
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {/* Search results */}
        {searchResults && searchResults.length > 0 && (
          <CommandGroup heading="Tasks">
            {searchResults.map((task) => (
              <CommandItem
                key={task._id}
                value={`task:${task._id}`}
                onSelect={handleSelect}
              >
                <span
                  className="mr-2 inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: task.projectColor }}
                />
                <span className="shrink-0 font-mono text-[10px] text-muted-foreground mr-2">
                  {task.cardId}
                </span>
                <span className="flex-1 truncate">{task.title}</span>
                <Badge variant="secondary" className="ml-2 text-[10px] px-1.5 py-0 shrink-0">
                  {STATUS_LABEL[task.status] ?? task.status}
                </Badge>
                <span className="ml-1 text-xs shrink-0">
                  {task.assignee === "dali" ? "\u{1F988}" : "\u{1F464}"}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        <CommandSeparator />

        {/* Actions */}
        <CommandGroup heading="Actions">
          <CommandItem value="create-task" onSelect={handleSelect}>
            <Plus className="mr-2 h-4 w-4" />
            Create task
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        {/* Navigation */}
        <CommandGroup heading="Navigation">
          <CommandItem value="go-board" onSelect={handleSelect}>
            <LayoutDashboard className="mr-2 h-4 w-4" />
            Go to Board
          </CommandItem>
          <CommandItem value="go-my-work" onSelect={handleSelect}>
            <FolderKanban className="mr-2 h-4 w-4" />
            Go to My Work
          </CommandItem>
          <CommandItem value="go-workflows" onSelect={handleSelect}>
            <Workflow className="mr-2 h-4 w-4" />
            Go to Workflows
          </CommandItem>
          <CommandItem value="go-analytics" onSelect={handleSelect}>
            <BarChart3 className="mr-2 h-4 w-4" />
            Go to Analytics
          </CommandItem>
          <CommandItem value="go-settings" onSelect={handleSelect}>
            <Settings className="mr-2 h-4 w-4" />
            Go to Settings
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
