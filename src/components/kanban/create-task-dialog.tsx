"use client";

import { Doc } from "../../../convex/_generated/dataModel";
import { type TaskStatus } from "@/lib/columns";

interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultStatus: TaskStatus;
  projects: Doc<"projects">[];
}

export function CreateTaskDialog(_props: CreateTaskDialogProps) {
  // Stub — implemented in US-014
  return null;
}
