"use client";

import { useState, ReactNode } from "react";
import { AppHeader } from "@/components/app-header";
import { AppSidebar } from "@/components/app-sidebar";
import { CommandPalette } from "@/components/command-palette";

export function AppLayout({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AppSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <AppHeader
          onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
          onSearchClick={() => setCommandOpen(true)}
        />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
      <CommandPalette
        externalOpen={commandOpen}
        onExternalOpenChange={setCommandOpen}
      />
    </div>
  );
}
