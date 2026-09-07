"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Chart palette tuned for the light canvas: mid-tone hues that stay legible
 * on a near-white card and hold up next to each other in a legend.
 */
export const CHART_COLORS = {
  primary: "hsl(205 84% 45%)",
  primarySoft: "hsl(205 74% 62%)",
  success: "hsl(152 55% 36%)",
  warning: "hsl(30 85% 46%)",
  danger: "hsl(0 70% 50%)",
  muted: "hsl(215 16% 60%)",
  grid: "hsl(205 28% 89%)",
  axis: "hsl(215 16% 46%)",
};

export const CATEGORICAL = [
  "hsl(205 84% 45%)",
  "hsl(258 62% 56%)",
  "hsl(330 62% 52%)",
  "hsl(152 55% 36%)",
  "hsl(30 85% 46%)",
  "hsl(188 68% 38%)",
];

export function ChartCard({
  title,
  description,
  action,
  children,
  className,
  contentClassName,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader className="flex-row items-start justify-between space-y-0 pb-3">
        <div className="space-y-1">
          <CardTitle>{title}</CardTitle>
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        {action}
      </CardHeader>
      <CardContent className={cn("flex-1", contentClassName)}>{children}</CardContent>
    </Card>
  );
}

interface TooltipEntry {
  name?: string;
  value?: number | string;
  color?: string;
  dataKey?: string | number;
  payload?: Record<string, unknown>;
}

/** Recharts tooltip styled to match the app surface. */
export function ChartTooltip({
  active,
  payload,
  label,
  formatter,
  labelFormatter,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string | number;
  formatter?: (value: number | string, entry: TooltipEntry) => React.ReactNode;
  labelFormatter?: (label: string | number) => React.ReactNode;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-lg">
      {label !== undefined && (
        <div className="mb-1 text-xs font-medium text-foreground">
          {labelFormatter ? labelFormatter(label) : label}
        </div>
      )}
      <div className="space-y-1">
        {payload.map((entry, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: entry.color ?? CHART_COLORS.primary }}
            />
            <span className="text-muted-foreground">{entry.name}</span>
            <span className="ml-auto font-medium tabular text-foreground">
              {formatter && entry.value !== undefined
                ? formatter(entry.value, entry)
                : entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export const AXIS_PROPS = {
  stroke: CHART_COLORS.axis,
  fontSize: 11,
  tickLine: false,
  axisLine: false,
} as const;
