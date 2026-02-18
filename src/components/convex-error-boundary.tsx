"use client";

import { Component, type ReactNode, type ErrorInfo } from "react";
import { Button } from "@/components/ui/button";
import { WifiOff, RefreshCw, AlertTriangle } from "lucide-react";

interface ConvexErrorBoundaryProps {
  children: ReactNode;
}

interface ConvexErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  isConnectionError: boolean;
}

/**
 * Convex-aware error boundary.
 *
 * Detects common Convex connection/backend errors and shows a helpful message
 * ("Backend unreachable — check your connection") instead of a generic crash.
 */
export class ConvexErrorBoundary extends Component<ConvexErrorBoundaryProps, ConvexErrorBoundaryState> {
  constructor(props: ConvexErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, isConnectionError: false };
  }

  static getDerivedStateFromError(error: Error): ConvexErrorBoundaryState {
    const message = error.message.toLowerCase();
    const isConnectionError =
      message.includes("convex") ||
      message.includes("network") ||
      message.includes("fetch") ||
      message.includes("websocket") ||
      message.includes("connection");

    return { hasError: true, error, isConnectionError };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ConvexErrorBoundary] Caught error:", error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, isConnectionError: false });
  };

  handleHardReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.state.isConnectionError) {
        return (
          <div className="flex min-h-[300px] flex-col items-center justify-center gap-4 p-8 text-center">
            <WifiOff className="h-10 w-10 text-muted-foreground" />
            <div>
              <p className="text-lg font-semibold text-foreground">Backend unreachable</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Can't connect to WOWWAI backend. Check your internet connection.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={this.handleRetry} className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Try again
              </Button>
              <Button size="sm" onClick={this.handleHardReload} className="gap-2">
                Reload page
              </Button>
            </div>
          </div>
        );
      }

      return (
        <div className="flex min-h-[300px] flex-col items-center justify-center gap-4 p-8 text-center">
          <AlertTriangle className="h-10 w-10 text-destructive" />
          <div>
            <p className="text-lg font-semibold text-foreground">Something went wrong</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {this.state.error?.message ?? "An unexpected error occurred"}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={this.handleRetry} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Try again
            </Button>
            <Button size="sm" onClick={this.handleHardReload} className="gap-2">
              Reload page
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
