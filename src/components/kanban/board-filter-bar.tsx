"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Doc } from "../../../convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn, getTagColor } from "@/lib/utils";
import { Filter, X } from "lucide-react";
import { useState } from "react";

export interface BoardFilters {
  projectId: string;
  assignee: string;
  priorities: string[];
  tags: string[];
  blockedOnly: boolean;
}

interface BoardFilterBarProps {
  projects: Doc<"projects">[];
  filters: BoardFilters;
  onFiltersChange: (filters: BoardFilters) => void;
}

export function BoardFilterBar({
  projects,
  filters,
  onFiltersChange,
}: BoardFilterBarProps) {
  const allTags = useQuery(api.tasks.getAllTags) ?? [];
  const [mobileOpen, setMobileOpen] = useState(false);

  const activeCount =
    (filters.projectId !== "all" ? 1 : 0) +
    (filters.assignee !== "all" ? 1 : 0) +
    filters.priorities.length +
    filters.tags.length +
    (filters.blockedOnly ? 1 : 0);

  function clearAll() {
    onFiltersChange({
      projectId: "all",
      assignee: "all",
      priorities: [],
      tags: [],
      blockedOnly: false,
    });
  }

  function togglePriority(p: string) {
    const next = filters.priorities.includes(p)
      ? filters.priorities.filter((x) => x !== p)
      : [...filters.priorities, p];
    onFiltersChange({ ...filters, priorities: next });
  }

  function toggleTag(tag: string) {
    const next = filters.tags.includes(tag)
      ? filters.tags.filter((x) => x !== tag)
      : [...filters.tags, tag];
    onFiltersChange({ ...filters, tags: next });
  }

  const filterContent = (
    <>
      {/* Project */}
      <Select
        value={filters.projectId}
        onValueChange={(v) => onFiltersChange({ ...filters, projectId: v })}
      >
        <SelectTrigger className="w-40">
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

      {/* Assignee toggle */}
      <div className="flex rounded-md border">
        {(["all", "dan", "dali"] as const).map((a) => (
          <button
            key={a}
            onClick={() => onFiltersChange({ ...filters, assignee: a })}
            className={cn(
              "px-3 py-1.5 text-xs font-medium transition-colors first:rounded-l-md last:rounded-r-md",
              filters.assignee === a
                ? "bg-primary text-primary-foreground"
                : "hover:bg-accent"
            )}
          >
            {a === "all" ? "All" : a === "dan" ? "\u{1F464} Dan" : "\u{1F988} Dali"}
          </button>
        ))}
      </div>

      {/* Priority multi-select */}
      <div className="flex gap-1">
        {(["urgent", "high", "medium", "low"] as const).map((p) => {
          const colors: Record<string, string> = {
            low: "bg-green-500",
            medium: "bg-blue-500",
            high: "bg-orange-500",
            urgent: "bg-red-500",
          };
          const isActive = filters.priorities.includes(p);
          return (
            <button
              key={p}
              onClick={() => togglePriority(p)}
              className={cn(
                "flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium transition-colors",
                isActive
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-transparent text-muted-foreground hover:bg-accent"
              )}
            >
              <span className={cn("h-2 w-2 rounded-full", colors[p])} />
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          );
        })}
      </div>

      {/* Tags multi-select */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {allTags.slice(0, 10).map((tag) => {
            const isActive = filters.tags.includes(tag);
            const color = getTagColor(tag);
            return (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-medium transition-colors border",
                  isActive
                    ? cn(color.bg, color.text, "border-current")
                    : "border-transparent text-muted-foreground hover:bg-accent"
                )}
              >
                {tag}
              </button>
            );
          })}
        </div>
      )}

      {/* Blocked only toggle */}
      <button
        onClick={() =>
          onFiltersChange({ ...filters, blockedOnly: !filters.blockedOnly })
        }
        className={cn(
          "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
          filters.blockedOnly
            ? "border-destructive bg-destructive/10 text-destructive"
            : "text-muted-foreground hover:bg-accent"
        )}
      >
        {"\u{1F534}"} Blocked only
      </button>

      {/* Clear all */}
      {activeCount > 0 && (
        <Button variant="ghost" size="sm" onClick={clearAll} className="h-7 text-xs">
          <X className="mr-1 h-3 w-3" />
          Clear ({activeCount})
        </Button>
      )}
    </>
  );

  return (
    <>
      {/* Desktop filter bar */}
      <div className="hidden lg:flex items-center gap-3 border-b px-4 py-3 flex-wrap">
        {filterContent}
      </div>

      {/* Mobile filter button */}
      <div className="flex items-center gap-2 border-b px-4 py-2 lg:hidden">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setMobileOpen(true)}
          className="gap-1.5"
        >
          <Filter className="h-4 w-4" />
          Filters
          {activeCount > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 min-w-5 justify-center px-1 text-[10px]">
              {activeCount}
            </Badge>
          )}
        </Button>
        {activeCount > 0 && (
          <Button variant="ghost" size="sm" onClick={clearAll} className="h-7 text-xs">
            Clear all
          </Button>
        )}
      </div>

      {/* Mobile filter sheet */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="bottom" className="max-h-[70vh]">
          <SheetHeader>
            <SheetTitle>Filters</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-4 p-4">{filterContent}</div>
        </SheetContent>
      </Sheet>
    </>
  );
}
