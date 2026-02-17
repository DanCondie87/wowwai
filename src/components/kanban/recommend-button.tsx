"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

interface Recommendation {
  cardId: string;
  title: string;
  reason: string;
  score: number;
  projectName: string;
}

export function RecommendButton() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const getRecommendations = useAction(api.recommend.getRecommendations);

  async function handleClick() {
    setOpen(true);
    setLoading(true);
    try {
      const recs = await getRecommendations({});
      setRecommendations(recs);
    } catch (error) {
      console.error("Failed to get recommendations:", error);
      setRecommendations([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={handleClick}
        className="gap-1.5"
      >
        <span aria-hidden>&#x1F916;</span>
        <span className="hidden sm:inline">What should I work on?</span>
        <span className="sm:hidden">Recommend</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Recommended Tasks</DialogTitle>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-sm text-muted-foreground">Analyzing tasks...</p>
            </div>
          ) : recommendations.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              No actionable tasks found. All tasks are either done or blocked.
            </p>
          ) : (
            <div className="space-y-3">
              {recommendations.map((rec, index) => (
                <div
                  key={rec.cardId}
                  className="rounded-lg border bg-card p-3 space-y-1"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-muted-foreground">
                      #{index + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {rec.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {rec.cardId} &middot; {rec.projectName}
                      </p>
                    </div>
                    <Badge variant="secondary" className="text-xs shrink-0">
                      {rec.score}pt
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground pl-7">
                    {rec.reason}
                  </p>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
