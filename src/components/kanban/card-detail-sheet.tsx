"use client";

import { Doc, Id } from "../../../convex/_generated/dataModel";

interface CardDetailSheetProps {
  taskId: Id<"tasks"> | null;
  onClose: () => void;
  projects: Doc<"projects">[];
}

export function CardDetailSheet(_props: CardDetailSheetProps) {
  // Stub — implemented in US-015
  return null;
}
