import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function KpiCard({
  label,
  value,
  delta,
  deltaNode,
  trend = "flat",
  sub,
  icon: Icon,
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  delta?: string;
  deltaNode?: React.ReactNode;
  trend?: "up" | "down" | "flat";
  sub?: string;
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
}) {
  const TrendIcon = trend === "up" ? ArrowUpRight : trend === "down" ? ArrowDownRight : Minus;
  const trendColor =
    trend === "up"
      ? "text-success"
      : trend === "down"
        ? "text-destructive"
        : "text-muted-foreground";

  return (
    <Card className={cn("p-4", className)}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground/70" />}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight tabular text-foreground">
        {value}
      </div>
      {(delta || deltaNode || sub) && (
        <div className="mt-1.5 flex items-center gap-2 text-xs">
          {(deltaNode ?? delta) && (
            <span className={cn("inline-flex items-center gap-0.5 font-medium", trendColor)}>
              <TrendIcon className="h-3 w-3" />
              {deltaNode ?? delta}
            </span>
          )}
          {sub && <span className="text-muted-foreground">{sub}</span>}
        </div>
      )}
    </Card>
  );
}

export function KpiCardSkeleton() {
  return (
    <Card className="p-4">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-3 h-7 w-16" />
      <Skeleton className="mt-3 h-3 w-20" />
    </Card>
  );
}
