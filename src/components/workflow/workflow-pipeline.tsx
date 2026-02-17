"use client";

import { useState } from "react";
import type { Doc } from "../../../convex/_generated/dataModel";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import {
  Code,
  Search,
  ClipboardCheck,
  Lightbulb,
  Pencil,
  Rocket,
  Eye,
  BookOpen,
  Brain,
  Target,
  Repeat,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

type WorkflowStep = Doc<"workflowSteps">;

interface WorkflowPipelineProps {
  steps: WorkflowStep[];
}

const AGENT_ICONS: Record<string, React.ElementType> = {
  planner: ClipboardCheck,
  architect: Lightbulb,
  coder: Code,
  tester: Search,
  reviewer: Eye,
  deployer: Rocket,
  researcher: Search,
  analyst: Brain,
  writer: Pencil,
  assessor: Target,
  practitioner: Code,
  evaluator: Eye,
};

function getStepIcon(agentType?: string): React.ElementType {
  if (!agentType) return BookOpen;
  return AGENT_ICONS[agentType] ?? BookOpen;
}

interface LoopGroup {
  id: string;
  maxIterations?: number;
  exitCriteria?: string;
  steps: WorkflowStep[];
}

function groupSteps(steps: WorkflowStep[]): Array<WorkflowStep | LoopGroup> {
  const result: Array<WorkflowStep | LoopGroup> = [];
  const loopGroups = new Map<string, LoopGroup>();

  for (const step of steps) {
    if (step.loopGroupId) {
      let group = loopGroups.get(step.loopGroupId);
      if (!group) {
        group = {
          id: step.loopGroupId,
          maxIterations: step.loopMaxIterations,
          exitCriteria: step.loopExitCriteria,
          steps: [],
        };
        loopGroups.set(step.loopGroupId, group);
        result.push(group);
      }
      if (step.loopMaxIterations && !group.maxIterations) {
        group.maxIterations = step.loopMaxIterations;
      }
      if (step.loopExitCriteria && !group.exitCriteria) {
        group.exitCriteria = step.loopExitCriteria;
      }
      group.steps.push(step);
    } else {
      result.push(step);
    }
  }

  return result;
}

function isLoopGroup(item: WorkflowStep | LoopGroup): item is LoopGroup {
  return "steps" in item && Array.isArray(item.steps) && "id" in item && !("_id" in item);
}

function StepCard({ step, isInsideLoop }: { step: WorkflowStep; isInsideLoop?: boolean }) {
  const Icon = getStepIcon(step.agentType);

  return (
    <AccordionItem value={step._id} className={cn("border rounded-lg", isInsideLoop && "border-dashed")}>
      <AccordionTrigger className="px-4 hover:no-underline">
        <div className="flex items-center gap-3 text-left">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                Step {step.order}
              </span>
              {step.agentType && (
                <Badge variant="outline" className="text-xs">
                  {step.agentType}
                </Badge>
              )}
            </div>
            <p className="font-medium">{step.name}</p>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-4">
        <div className="space-y-3 pl-11">
          <p className="text-muted-foreground">{step.description}</p>

          {step.modelRecommendation && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Model:</span>
              <Badge variant="secondary" className="text-xs">
                {step.modelRecommendation}
              </Badge>
            </div>
          )}

          {step.references.length > 0 && (
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">
                References
              </span>
              {step.references.map((ref, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 text-sm text-muted-foreground"
                >
                  <span>{ref.type === "claude_md" ? "\uD83D\uDCC4" : ref.type === "prompt_template" ? "\uD83D\uDCDD" : "\uD83D\uDCDA"}</span>
                  <span>{ref.label}</span>
                  <span className="text-xs opacity-60">({ref.filePath})</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

function LoopGroupContainer({ group }: { group: LoopGroup }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 p-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 text-left text-sm font-medium"
      >
        <Repeat className="h-4 w-4 text-primary" />
        <span>
          {group.id.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())} Loop
        </span>
        <Badge variant="secondary" className="text-xs">
          {group.steps.length} {group.steps.length === 1 ? "step" : "steps"}
        </Badge>
        {group.maxIterations && (
          <Badge variant="outline" className="text-xs">
            max {group.maxIterations}x
          </Badge>
        )}
        <ChevronDown
          className={cn(
            "ml-auto h-4 w-4 transition-transform text-muted-foreground",
            expanded && "rotate-180"
          )}
        />
      </button>
      {group.exitCriteria && (
        <p className="mt-1 ml-6 text-xs text-muted-foreground">
          Exit: {group.exitCriteria}
        </p>
      )}
      {expanded && (
        <div className="mt-3 space-y-2 pl-2">
          <Accordion type="multiple">
            {group.steps.map((step) => (
              <StepCard key={step._id} step={step} isInsideLoop />
            ))}
          </Accordion>
        </div>
      )}
    </div>
  );
}

export function WorkflowPipeline({ steps }: WorkflowPipelineProps) {
  const items = groupSteps(steps);

  return (
    <div className="relative">
      {/* Vertical connector line */}
      <div className="absolute left-[1.25rem] top-4 bottom-4 w-0.5 bg-border sm:left-[1.5rem]" />

      <div className="relative space-y-3">
        <Accordion type="multiple">
          {items.map((item, index) => (
            <div key={isLoopGroup(item) ? item.id : item._id} className="relative">
              {/* Connector dot */}
              <div className="absolute left-[0.875rem] top-5 z-10 h-3 w-3 rounded-full border-2 border-primary bg-background sm:left-[1.125rem]" />

              <div className="pl-10 sm:pl-12">
                {isLoopGroup(item) ? (
                  <LoopGroupContainer group={item} />
                ) : (
                  <StepCard step={item} />
                )}
              </div>
            </div>
          ))}
        </Accordion>
      </div>
    </div>
  );
}
