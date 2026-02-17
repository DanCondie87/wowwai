export type TaskStatus = "backlog" | "todo" | "in-progress" | "review" | "done";

export interface ColumnDef {
  id: TaskStatus;
  label: string;
}

export const COLUMNS: ColumnDef[] = [
  { id: "backlog", label: "Backlog" },
  { id: "todo", label: "To Do" },
  { id: "in-progress", label: "In Progress" },
  { id: "review", label: "Review" },
  { id: "done", label: "Done" },
];
