"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Workflow, FileText, Layers } from "lucide-react";

export default function WorkflowsPage() {
  const templates = useQuery(api.workflows.getAllTemplates);

  if (templates === undefined) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-muted-foreground">Loading workflows...</p>
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-8">
        <Workflow className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">No workflow templates yet</p>
        <p className="text-sm text-muted-foreground">
          Run the seed script to load the default templates.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold">Workflows</h1>
        <p className="text-sm text-muted-foreground">
          Browse and explore workflow templates
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((template) => (
          <Link
            key={template._id}
            href={`/workflows/${template._id}`}
            className="group"
          >
            <Card className="h-full transition-shadow hover:shadow-md">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Workflow className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">{template.name}</CardTitle>
                </div>
                {template.description && (
                  <CardDescription>{template.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">
                    <Layers className="mr-1 h-3 w-3" />
                    {template.stepCount} {template.stepCount === 1 ? "step" : "steps"}
                  </Badge>
                  {template.sourceFile && (
                    <Badge variant="outline">
                      <FileText className="mr-1 h-3 w-3" />
                      {template.sourceFile}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
