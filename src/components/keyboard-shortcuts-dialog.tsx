"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface KeyboardShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SHORTCUTS = [
  { category: "Navigation", items: [
    { keys: ["g", "b"], description: "Go to Board" },
    { keys: ["g", "w"], description: "Go to Workflows" },
    { keys: ["g", "a"], description: "Go to Analytics" },
    { keys: ["g", "m"], description: "Go to My Work" },
    { keys: ["g", "s"], description: "Go to Settings" },
  ]},
  { category: "Board", items: [
    { keys: ["n"], description: "New task" },
    { keys: ["e"], description: "Edit selected card" },
    { keys: ["j"], description: "Next card" },
    { keys: ["k"], description: "Previous card" },
    { keys: ["\u2192"], description: "Move card to next column" },
    { keys: ["\u2190"], description: "Move card to previous column" },
  ]},
  { category: "General", items: [
    { keys: ["\u2318", "K"], description: "Command palette" },
    { keys: ["/"], description: "Focus search" },
    { keys: ["?"], description: "Show this help" },
  ]},
];

export function KeyboardShortcutsDialog({ open, onOpenChange }: KeyboardShortcutsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {SHORTCUTS.map((section) => (
            <div key={section.category}>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">
                {section.category}
              </h3>
              <div className="space-y-1">
                {section.items.map((shortcut) => (
                  <div
                    key={shortcut.description}
                    className="flex items-center justify-between py-1"
                  >
                    <span className="text-sm text-foreground">
                      {shortcut.description}
                    </span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, i) => (
                        <span key={i}>
                          {i > 0 && (
                            <span className="text-xs text-muted-foreground mx-0.5">
                              then
                            </span>
                          )}
                          <kbd className="inline-flex items-center justify-center rounded border bg-muted px-1.5 py-0.5 text-xs font-mono text-muted-foreground min-w-[24px]">
                            {key}
                          </kbd>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
