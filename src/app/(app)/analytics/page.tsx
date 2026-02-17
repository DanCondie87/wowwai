"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const PIE_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2, 160 60% 45%))",
  "hsl(var(--chart-3, 30 80% 55%))",
  "hsl(var(--chart-4, 280 65% 60%))",
  "hsl(var(--chart-5, 340 75% 55%))",
];

export default function AnalyticsPage() {
  const cycleTime = useQuery(api.analytics.getCycleTime);
  const throughput = useQuery(api.analytics.getThroughput);
  const blockerStats = useQuery(api.analytics.getBlockerStats);
  const modelUsage = useQuery(api.analytics.getModelUsage);

  const isLoading =
    cycleTime === undefined ||
    throughput === undefined ||
    blockerStats === undefined ||
    modelUsage === undefined;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-muted-foreground">Loading analytics...</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold text-foreground">Analytics</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card 1: Average Cycle Time */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Average Cycle Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            {cycleTime.length === 0 ? (
              <p className="text-sm text-muted-foreground">No completed tasks yet</p>
            ) : (
              <div className="space-y-2">
                {cycleTime.map((entry) => (
                  <div
                    key={entry.projectId}
                    className="flex items-center justify-between"
                  >
                    <span className="text-sm text-foreground">
                      {entry.projectName}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold text-foreground">
                        {entry.avgCycleTimeDays}
                      </span>
                      <span className="text-xs text-muted-foreground">days</span>
                      <Badge variant="secondary" className="text-xs">
                        {entry.completedCount} done
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card 2: Weekly Throughput */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Weekly Throughput
            </CardTitle>
          </CardHeader>
          <CardContent>
            {throughput.every((w) => w.count === 0) ? (
              <p className="text-sm text-muted-foreground">No completed tasks yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={throughput}>
                  <XAxis
                    dataKey="weekStart"
                    tick={{ fontSize: 11 }}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11 }}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "6px",
                      color: "hsl(var(--foreground))",
                    }}
                  />
                  <Bar
                    dataKey="count"
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Card 3: Blocked Tasks */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Blocked Tasks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2 mb-3">
              <span className="text-3xl font-bold text-foreground">
                {blockerStats.totalBlocked}
              </span>
              <span className="text-sm text-muted-foreground">
                currently blocked
              </span>
            </div>
            {blockerStats.byProject.length > 0 ? (
              <div className="space-y-2">
                {blockerStats.byProject.map((entry) => (
                  <div key={entry.projectName}>
                    <p className="text-sm font-medium text-foreground">
                      {entry.projectName}{" "}
                      <Badge variant="destructive" className="text-xs">
                        {entry.count}
                      </Badge>
                    </p>
                    <div className="ml-2 mt-1 space-y-0.5">
                      {entry.tasks.map((t) => (
                        <p
                          key={t.cardId}
                          className="text-xs text-muted-foreground"
                        >
                          {t.cardId}: {t.title}
                        </p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No blocked tasks</p>
            )}
          </CardContent>
        </Card>

        {/* Card 4: Model Usage */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Model Usage
            </CardTitle>
          </CardHeader>
          <CardContent>
            {modelUsage.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No model usage data yet
              </p>
            ) : (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width={120} height={120}>
                  <PieChart>
                    <Pie
                      data={modelUsage}
                      dataKey="count"
                      nameKey="model"
                      cx="50%"
                      cy="50%"
                      outerRadius={50}
                      strokeWidth={2}
                      stroke="hsl(var(--card))"
                    >
                      {modelUsage.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={PIE_COLORS[index % PIE_COLORS.length]}
                        />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-1">
                  {modelUsage.map((entry, index) => (
                    <div
                      key={entry.model}
                      className="flex items-center justify-between text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{
                            backgroundColor:
                              PIE_COLORS[index % PIE_COLORS.length],
                          }}
                        />
                        <span className="text-foreground">{entry.model}</span>
                      </div>
                      <span className="font-medium text-foreground">
                        {entry.count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
