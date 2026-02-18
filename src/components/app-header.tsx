"use client";

import { Menu, Search, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

interface AppHeaderProps {
  onMenuToggle: () => void;
  onSearchClick?: () => void;
}

export function AppHeader({ onMenuToggle, onSearchClick }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b bg-background px-4 lg:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onMenuToggle}
      >
        <Menu className="h-5 w-5" />
        <span className="sr-only">Toggle menu</span>
      </Button>

      <div className="flex items-center gap-2">
        <h1 className="text-lg font-bold tracking-tight text-foreground">
          WOWWAI
        </h1>
      </div>

      <div className="ml-auto flex items-center gap-2">
        {/* Search button — mobile: icon, desktop: shows shortcut hint */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onSearchClick}
          title="Search (Ctrl+K)"
        >
          <Search className="h-5 w-5" />
          <span className="sr-only">Search</span>
        </Button>
        <ThemeToggle />
        <Button
          variant="ghost"
          size="icon"
          onClick={async () => {
            await fetch("/api/auth/logout", { method: "POST" });
            window.location.href = "/login";
          }}
          title="Log out"
        >
          <User className="h-5 w-5" />
          <span className="sr-only">Log out</span>
        </Button>
      </div>
    </header>
  );
}
