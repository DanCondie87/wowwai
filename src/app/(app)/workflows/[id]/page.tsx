"use client";

import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WorkflowPipeline } from "@/components/workflow/workflow-pipeline";

export default function WorkflowDetailPage() {
  const params = useParams();
  const templateId = params.id as Id<"workflowTemplates">;
  const data = useQuery(api.workflows.getTemplateWithSteps, { templateId });

  if (data === undefined) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-muted-foreground">Loading workflow...</p>
      </div>
    );
  }

  if (data === null) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-8">
        <p className="text-muted-foreground">Workflow not found</p>
        <Button variant="outline" asChild>
          <Link href="/workflows">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Workflows
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/workflows">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{data.name}</h1>
          {data.description && (
            <p className="text-sm text-muted-foreground">{data.description}</p>
          )}
        </div>
      </div>

      <WorkflowPipeline steps={data.steps} />
    </div>
  );
}
