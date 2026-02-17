"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Markdown } from "@/components/ui/markdown";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Eye,
  Pencil,
  Save,
  X,
  History,
  RotateCcw,
  FileText,
  FileCode,
  BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Reference {
  type: string;
  label: string;
  filePath: string;
  section?: string;
  content?: string;
}

function getReferenceIcon(type: string) {
  switch (type) {
    case "claude_md":
      return <FileCode className="h-3.5 w-3.5" />;
    case "prompt_template":
      return <FileText className="h-3.5 w-3.5" />;
    default:
      return <BookOpen className="h-3.5 w-3.5" />;
  }
}

interface DocumentReferenceProps {
  reference: Reference;
}

export function DocumentReference({ reference }: DocumentReferenceProps) {
  const [viewOpen, setViewOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [saved, setSaved] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const latestVersion = useQuery(api.fileVersions.getLatestByFilePath, {
    filePath: reference.filePath,
  });
  const versionCount = useQuery(api.fileVersions.getVersionCount, {
    filePath: reference.filePath,
  });
  const allVersions = useQuery(
    api.fileVersions.getByFilePath,
    historyOpen ? { filePath: reference.filePath } : "skip"
  );

  const createVersion = useMutation(api.fileVersions.createVersion);
  const enqueueSync = useMutation(api.fileSyncQueue.enqueue);

  const content = latestVersion?.content ?? reference.content;
  const hasSyncedContent = latestVersion !== null && latestVersion !== undefined;
  const hasUnsavedChanges = editing && editContent !== (content ?? "");

  function handleEdit() {
    setEditContent(content ?? "");
    setEditing(true);
  }

  async function handleSave() {
    await createVersion({
      filePath: reference.filePath,
      content: editContent,
      editedBy: "dan",
      editedVia: "web-ui",
    });
    await enqueueSync({
      filePath: reference.filePath,
      content: editContent,
      direction: "to-local",
      status: "pending",
    });
    setEditing(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function handleCancelEdit() {
    setEditing(false);
  }

  async function handleRestore(versionContent: string) {
    await createVersion({
      filePath: reference.filePath,
      content: versionContent,
      editedBy: "dan",
      editedVia: "web-ui-restore",
    });
    await enqueueSync({
      filePath: reference.filePath,
      content: versionContent,
      direction: "to-local",
      status: "pending",
    });
    setHistoryOpen(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="flex items-center gap-2 rounded-md border bg-muted/30 p-2 text-sm">
      <span className="text-muted-foreground">
        {getReferenceIcon(reference.type)}
      </span>
      <span className="min-w-0 flex-1 truncate font-medium">
        {reference.label}
      </span>
      <span className="hidden text-xs text-muted-foreground sm:inline">
        {reference.filePath}
      </span>

      {/* Version badge */}
      {versionCount !== undefined && versionCount > 0 && (
        <button onClick={() => setHistoryOpen(true)}>
          <Badge variant="outline" className="cursor-pointer text-xs">
            v{versionCount}
          </Badge>
        </button>
      )}

      {!hasSyncedContent && !content && (
        <Badge variant="secondary" className="text-xs">
          Not synced
        </Badge>
      )}

      {saved && (
        <span className="text-xs text-green-600 dark:text-green-400">Saved</span>
      )}

      <Button
        variant="ghost"
        size="xs"
        onClick={() => setViewOpen(true)}
      >
        <Eye className="h-3 w-3" />
        View
      </Button>
      <Button
        variant="ghost"
        size="xs"
        onClick={() => {
          setViewOpen(true);
          handleEdit();
        }}
      >
        <Pencil className="h-3 w-3" />
        Edit
      </Button>

      {/* View/Edit Panel */}
      <Sheet open={viewOpen} onOpenChange={(open) => {
        if (!open) {
          setEditing(false);
        }
        setViewOpen(open);
      }}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              {getReferenceIcon(reference.type)}
              {reference.label}
            </SheetTitle>
            <SheetDescription>
              {editing ? `Editing: ${reference.filePath}` : reference.filePath}
              {reference.section && ` > ${reference.section}`}
            </SheetDescription>
          </SheetHeader>

          <div className="p-4 space-y-4">
            {editing && hasUnsavedChanges && (
              <div className="flex items-center gap-2 rounded-md border border-orange-300 bg-orange-50 px-3 py-1.5 text-xs text-orange-700 dark:border-orange-700 dark:bg-orange-950/30 dark:text-orange-300">
                Unsaved changes
              </div>
            )}

            {editing ? (
              <>
                <Textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="min-h-[300px] font-mono text-sm"
                  placeholder="Enter markdown content..."
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSave}>
                    <Save className="mr-1 h-3 w-3" />
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCancelEdit}
                  >
                    <X className="mr-1 h-3 w-3" />
                    Cancel
                  </Button>
                </div>
              </>
            ) : content ? (
              <>
                <Markdown>{content}</Markdown>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleEdit}
                >
                  <Pencil className="mr-1 h-3 w-3" />
                  Edit
                </Button>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 py-8 text-muted-foreground">
                <FileText className="h-8 w-8" />
                <p className="text-sm">Content not synced yet</p>
                <p className="text-xs">
                  File path: {reference.filePath}
                </p>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Version History Panel */}
      <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Version History
            </SheetTitle>
            <SheetDescription>{reference.filePath}</SheetDescription>
          </SheetHeader>

          <div className="p-4 space-y-3">
            {allVersions?.map((version, index) => (
              <VersionEntry
                key={version._id}
                version={version}
                isCurrent={index === 0}
                onRestore={() => handleRestore(version.content)}
              />
            ))}
            {allVersions?.length === 0 && (
              <p className="text-sm text-muted-foreground">No versions yet</p>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function VersionEntry({
  version,
  isCurrent,
  onRestore,
}: {
  version: {
    _id: string;
    content: string;
    editedBy: string;
    editedVia: string;
    timestamp: number;
  };
  isCurrent: boolean;
  onRestore: () => void;
}) {
  const [showPreview, setShowPreview] = useState(false);
  const date = new Date(version.timestamp);
  const timeAgo = getRelativeTime(version.timestamp);

  return (
    <div className="rounded-md border p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">
            {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
          {isCurrent && (
            <Badge variant="default" className="text-xs">
              Current
            </Badge>
          )}
        </div>
        <span className="text-xs text-muted-foreground">{timeAgo}</span>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>By: {version.editedBy}</span>
        <span>Via: {version.editedVia}</span>
      </div>
      <div className="flex gap-2">
        <Button
          variant="ghost"
          size="xs"
          onClick={() => setShowPreview(!showPreview)}
        >
          <Eye className="h-3 w-3" />
          {showPreview ? "Hide" : "Preview"}
        </Button>
        {!isCurrent && (
          <Button variant="ghost" size="xs" onClick={onRestore}>
            <RotateCcw className="h-3 w-3" />
            Restore
          </Button>
        )}
      </div>
      {showPreview && (
        <div className="rounded-md border bg-muted/30 p-3">
          <Markdown>{version.content}</Markdown>
        </div>
      )}
    </div>
  );
}

function getRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
