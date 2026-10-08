import type { HealthTrendPoint } from "@sonofcotester/sdk";

interface TrendChartProps {
  data: HealthTrendPoint[];
}

const LINES = [
  { key: "overallScore" as const, color: "#0f766e", label: "Overall" },
  { key: "securityScore" as const, color: "#ef4444", label: "Security" },
  { key: "uiScore" as const, color: "#8b5cf6", label: "UI/UX" },
  { key: "dbScore" as const, color: "#f59e0b", label: "Database" },
  { key: "performanceScore" as const, color: "#3b82f6", label: "Performance" },
];

const WIDTH = 700;
const HEIGHT = 200;
const PADDING = { top: 10, right: 10, bottom: 24, left: 36 };

function buildPath(data: HealthTrendPoint[], key: keyof HealthTrendPoint): string {
  if (data.length === 0) return "";
  const plotW = WIDTH - PADDING.left - PADDING.right;
  const plotH = HEIGHT - PADDING.top - PADDING.bottom;
  const step = data.length > 1 ? plotW / (data.length - 1) : plotW;

  return data
    .map((point, i) => {
      const x = PADDING.left + i * step;
      const val = (point[key] as number) ?? 0;
      const y = PADDING.top + plotH - (val / 100) * plotH;
      return `${i === 0 ? "M" : "L"}${x},${y}`;
    })
    .join(" ");
}

function buildAreaPath(data: HealthTrendPoint[], key: keyof HealthTrendPoint): string {
  if (data.length === 0) return "";
  const linePath = buildPath(data, key);
  const plotW = WIDTH - PADDING.left - PADDING.right;
  const plotH = HEIGHT - PADDING.top - PADDING.bottom;
  const step = data.length > 1 ? plotW / (data.length - 1) : plotW;
  const lastX = PADDING.left + (data.length - 1) * step;
  const bottom = PADDING.top + plotH;
  return `${linePath} L${lastX},${bottom} L${PADDING.left},${bottom} Z`;
}

export function TrendChart({ data }: TrendChartProps) {
  return (
    <div>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" style={{ maxHeight: 200 }}>
        {/* Grid lines */}
        {[0, 25, 50, 75, 100].map((val) => {
          const y = PADDING.top + (HEIGHT - PADDING.top - PADDING.bottom) * (1 - val / 100);
          return (
            <g key={val}>
              <line x1={PADDING.left} y1={y} x2={WIDTH - PADDING.right} y2={y} stroke="#e2e8f0" strokeWidth={0.5} />
              <text x={PADDING.left - 6} y={y + 3} textAnchor="end" fontSize={9} fill="#94a3b8">
                {val}
              </text>
            </g>
          );
        })}

        {/* Data lines */}
        {LINES.map(({ key, color }) => (
          <g key={key}>
            <path d={buildAreaPath(data, key)} fill={color} fillOpacity={0.06} />
            <path d={buildPath(data, key)} fill="none" stroke={color} strokeWidth={key === "overallScore" ? 2.5 : 1.5} strokeLinecap="round" strokeLinejoin="round" />
          </g>
        ))}
      </svg>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-4">
        {LINES.map(({ key, color, label }) => (
          <div key={key} className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}
