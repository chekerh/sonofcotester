import type { HealthDimensionScore } from "@sonofcotester/sdk";
import { ChartBar, Flask, Lightning, Minus, Palette, ShieldCheck, Stack, TrendDown, TrendUp } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";

const ICONS: Record<string, Icon> = {
  security: ShieldCheck,
  "ui-ux": Palette,
  database: Stack,
  performance: Lightning,
  testing: Flask,
};

const TREND_ICONS: Record<string, Icon> = {
  improving: TrendUp,
  stable: Minus,
  degrading: TrendDown,
};


const STATUS_STYLES: Record<string, string> = {
  excellent: "bg-emerald-50 text-emerald-700",
  good: "bg-green-50 text-green-700",
  fair: "bg-amber-50 text-amber-700",
  poor: "bg-orange-50 text-orange-700",
  critical: "bg-red-50 text-red-700",
};


export function DimensionCard({ dimension }: { dimension: HealthDimensionScore }) {
  const DimIcon = ICONS[dimension.dimension] ?? ChartBar;
  const TrendIcon = TREND_ICONS[dimension.trend] ?? Minus;
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="flex items-center justify-between">
        <DimIcon size={26} weight="bold" className="text-slate-700" aria-hidden="true" />
        <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${STATUS_STYLES[dimension.status]}`}>
          {dimension.status}
        </span>
      </div>
      <div className="mt-4">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-slate-900">{dimension.score}</span>
          <span className="text-xs text-slate-500">/ 100</span>
          <span className={`ml-auto text-sm font-semibold ${dimension.trend === "improving" ? "text-emerald-600" : dimension.trend === "degrading" ? "text-red-500" : "text-slate-500"}`}>
            <TrendIcon size={15} weight="bold" aria-hidden="true" />
          </span>
        </div>
        <p className="mt-1 text-xs font-medium capitalize text-slate-500">{dimension.dimension.replace("-", "/")}</p>
      </div>
      {dimension.issueCount > 0 && (
        <div className="mt-3 rounded-xl bg-slate-50 px-3 py-1.5 text-xs text-slate-600">
          {dimension.issueCount} issue{dimension.issueCount !== 1 ? "s" : ""} detected
        </div>
      )}
      {dimension.lastChecked && (
        <p className="mt-2 text-[10px] text-slate-500">
          Last checked: {new Date(dimension.lastChecked).toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}
