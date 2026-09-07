"use client";

import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";
import { AXIS_PROPS, CATEGORICAL, CHART_COLORS, ChartTooltip } from "@/components/charts/chart-primitives";
import { PLATFORM_META, countryFlagFor, countryName } from "@/lib/constants";
import { compactNumber, fullNumber } from "@/lib/format";
import type { Platform } from "@/lib/types";
import { useLocale, useT } from "@/lib/i18n/provider";

export function PlatformDonut({
  data,
  height = 240,
}: {
  data: { platform: Platform; name: string; value: number }[];
  height?: number;
}) {
  const t = useT();
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="relative w-full sm:w-[190px]" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="62%"
              outerRadius="86%"
              paddingAngle={2}
              stroke="none"
            >
              {data.map((d) => (
                <Cell key={d.platform} fill={PLATFORM_META[d.platform].color} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip formatter={(v) => fullNumber(Number(v))} />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-semibold tabular">{compactNumber(total)}</span>
          <span className="text-[11px] text-muted-foreground">{t("dashboard.donutCenter")}</span>
        </div>
      </div>
      <ul className="w-full flex-1 space-y-2">
        {data.map((d) => (
          <li key={d.platform} className="flex items-center gap-2 text-[13px]">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: PLATFORM_META[d.platform].color }}
            />
            <span className="text-muted-foreground">{d.name}</span>
            <span className="ml-auto font-medium tabular">{fullNumber(d.value)}</span>
            <span className="w-11 text-right text-xs tabular text-muted-foreground">
              {((d.value / total) * 100).toFixed(1)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SizeDistributionBars({
  data,
  height = 240,
}: {
  data: { bucket: string; value: number }[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
        {/* interval=0 keeps every bucket labelled even in a narrow card */}
        <XAxis dataKey="bucket" {...AXIS_PROPS} interval={0} fontSize={10} />
        <YAxis {...AXIS_PROPS} width={44} />
        <Tooltip
          cursor={{ fill: "hsl(205 45% 92%)" }}
          content={<ChartTooltip formatter={(v) => fullNumber(Number(v))} />}
        />
        <Bar dataKey="value" name="Creators" radius={[4, 4, 0, 0]} maxBarSize={54}>
          {data.map((_, i) => (
            <Cell key={i} fill={i < 3 ? CHART_COLORS.primary : "hsl(205 55% 72%)"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Horizontal ranked bars — used for countries and languages. */
export function RankedBars({
  data,
  valueLabel = "Creators",
  showFlags = false,
  barColor = CHART_COLORS.primary,
  formatValue = (v: number) => fullNumber(v),
}: {
  data: { key: string; label: string; value: number; code?: string; labelKey?: string }[];
  valueLabel?: string;
  showFlags?: boolean;
  barColor?: string;
  formatValue?: (v: number) => string;
}) {
  const t = useT();
  const locale = useLocale();
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <ul className="space-y-2.5">
      {data.map((d) => (
        <li key={d.key} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1">
          <div className="flex min-w-0 items-center gap-2 text-[13px]">
            {showFlags && d.code && <span aria-hidden>{countryFlagFor(d.code)}</span>}
            <span className="truncate text-muted-foreground">{d.labelKey ? t(d.labelKey) : d.code ? countryName(d.code, locale) : d.label}</span>
          </div>
          <span className="text-[13px] font-medium tabular">{formatValue(d.value)}</span>
          <div className="col-span-2 h-1.5 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${(d.value / max) * 100}%`, backgroundColor: barColor }}
              role="img"
              aria-label={`${d.label}: ${formatValue(d.value)} ${valueLabel}`}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function ReplyRateBars({
  data,
  height = 260,
}: {
  data: { name: string; rate: number; sent: number }[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} horizontal={false} />
        <XAxis type="number" {...AXIS_PROPS} unit="%" domain={[0, "dataMax + 6"]} />
        <YAxis type="category" dataKey="name" {...AXIS_PROPS} width={92} />
        <Tooltip
          cursor={{ fill: "hsl(205 45% 92%)" }}
          content={<ChartTooltip formatter={(v) => `${v}%`} />}
        />
        <Bar dataKey="rate" name="Reply rate" radius={[0, 4, 4, 0]} maxBarSize={18}>
          {data.map((d, i) => (
            <Cell
              key={i}
              fill={d.rate >= 25 ? CHART_COLORS.success : d.rate >= 18 ? CHART_COLORS.primary : "hsl(205 45% 70%)"}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CampaignPerformanceBars({
  data,
  height = 280,
}: {
  data: { name: string; contacted: number; replied: number; interested: number }[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
        <XAxis
          dataKey="name"
          {...AXIS_PROPS}
          interval={0}
          tickFormatter={(v: string) => (v.length > 14 ? v.slice(0, 13) + "…" : v)}
        />
        <YAxis {...AXIS_PROPS} width={44} />
        <Tooltip cursor={{ fill: "hsl(205 45% 92%)" }} content={<ChartTooltip />} />
        <Legend
          verticalAlign="top"
          align="right"
          height={28}
          iconType="circle"
          iconSize={8}
          formatter={(value) => (
            <span className="text-xs text-muted-foreground">{value}</span>
          )}
        />
        <Bar dataKey="contacted" name="Contacted" fill={CATEGORICAL[0]} radius={[3, 3, 0, 0]} maxBarSize={26} />
        <Bar dataKey="replied" name="Replied" fill={CATEGORICAL[1]} radius={[3, 3, 0, 0]} maxBarSize={26} />
        <Bar dataKey="interested" name="Interested" fill={CHART_COLORS.success} radius={[3, 3, 0, 0]} maxBarSize={26} />
      </BarChart>
    </ResponsiveContainer>
  );
}
