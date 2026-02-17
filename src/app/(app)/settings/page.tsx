"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

function downloadFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function tasksToCsv(
  tasks: Array<Record<string, unknown>>,
  projects: Array<Record<string, unknown>>
): string {
  const projectMap = new Map(
    projects.map((p) => [p._id as string, p.name as string])
  );
  const headers = [
    "cardId",
    "title",
    "project",
    "status",
    "assignee",
    "priority",
    "tags",
    "createdAt",
    "completedAt",
  ];
  const rows = tasks.map((t) => [
    t.cardId,
    `"${String(t.title ?? "").replace(/"/g, '""')}"`,
    projectMap.get(t.projectId as string) ?? "",
    t.status,
    t.assignee,
    t.priority,
    `"${(t.tags as string[])?.join(", ") ?? ""}"`,
    t.createdAt ? new Date(t.createdAt as number).toISOString() : "",
    t.completedAt ? new Date(t.completedAt as number).toISOString() : "",
  ]);
  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

export default function SettingsPage() {
  const exportData = useQuery(api.export.getFullExport);

  function handleExportJson() {
    if (!exportData) return;
    const json = JSON.stringify(exportData, null, 2);
    const date = new Date().toISOString().slice(0, 10);
    downloadFile(json, `wowwai-export-${date}.json`, "application/json");
  }

  function handleExportCsv() {
    if (!exportData) return;
    const csv = tasksToCsv(exportData.tasks, exportData.projects);
    const date = new Date().toISOString().slice(0, 10);
    downloadFile(csv, `wowwai-tasks-${date}.csv`, "text/csv");
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your preferences and data
        </p>
      </div>

      <div className="rounded-lg border bg-card p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Export Data</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Download a backup of all your projects, tasks, ideas, and audit logs.
          </p>
        </div>

        <div className="flex gap-3">
          <Button
            onClick={handleExportJson}
            disabled={!exportData}
            variant="outline"
          >
            <Download className="mr-2 h-4 w-4" />
            Export as JSON
          </Button>
          <Button
            onClick={handleExportCsv}
            disabled={!exportData}
            variant="outline"
          >
            <Download className="mr-2 h-4 w-4" />
            Export as CSV
          </Button>
        </div>

        {!exportData && (
          <p className="text-xs text-muted-foreground">Loading data...</p>
        )}
      </div>
    </div>
  );
}
