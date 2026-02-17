"use client";

import { useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

interface KeyboardShortcutsConfig {
  onNewTask?: () => void;
  onEditCard?: () => void;
  onNextCard?: () => void;
  onPrevCard?: () => void;
  onMoveRight?: () => void;
  onMoveLeft?: () => void;
  onFocusSearch?: () => void;
  onShowHelp?: () => void;
}

export function useKeyboardShortcuts(config: KeyboardShortcutsConfig = {}) {
  const router = useRouter();
  const pendingKey = { current: "" };

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't handle shortcuts when typing in inputs
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable
      ) {
        return;
      }

      // Handle "g" prefix sequences
      if (pendingKey.current === "g") {
        pendingKey.current = "";
        switch (e.key) {
          case "b":
            e.preventDefault();
            router.push("/board");
            return;
          case "w":
            e.preventDefault();
            router.push("/workflows");
            return;
          case "a":
            e.preventDefault();
            router.push("/analytics");
            return;
          case "m":
            e.preventDefault();
            router.push("/my-work");
            return;
          case "s":
            e.preventDefault();
            router.push("/settings");
            return;
        }
        return;
      }

      switch (e.key) {
        case "g":
          pendingKey.current = "g";
          // Clear pending after 1 second
          setTimeout(() => {
            pendingKey.current = "";
          }, 1000);
          return;

        case "n":
          e.preventDefault();
          config.onNewTask?.();
          return;

        case "e":
          e.preventDefault();
          config.onEditCard?.();
          return;

        case "j":
          e.preventDefault();
          config.onNextCard?.();
          return;

        case "k":
          e.preventDefault();
          config.onPrevCard?.();
          return;

        case "ArrowRight":
          if (!e.metaKey && !e.ctrlKey) {
            e.preventDefault();
            config.onMoveRight?.();
          }
          return;

        case "ArrowLeft":
          if (!e.metaKey && !e.ctrlKey) {
            e.preventDefault();
            config.onMoveLeft?.();
          }
          return;

        case "/":
          e.preventDefault();
          config.onFocusSearch?.();
          return;

        case "?":
          e.preventDefault();
          config.onShowHelp?.();
          return;
      }
    },
    [router, config]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}
