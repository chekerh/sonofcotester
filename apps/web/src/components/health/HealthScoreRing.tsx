const COLORS = [
  { threshold: 0, color: "#ef4444" },
  { threshold: 35, color: "#f97316" },
  { threshold: 55, color: "#eab308" },
  { threshold: 75, color: "#22c55e" },
  { threshold: 90, color: "#10b981" },
];

function scoreColor(score: number): string {
  let color = COLORS[0]!.color;
  for (const { threshold, color: c } of COLORS) {
    if (score >= threshold) color = c;
  }
  return color;
}

export function HealthScoreRing({ score, size = 160 }: { score: number; size?: number }) {
  const strokeWidth = size * 0.08;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = scoreColor(score);
  const center = size / 2;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Background ring */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={strokeWidth}
        />
        {/* Score arc */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 800ms cubic-bezier(0.16, 1, 0.3, 1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-bold" style={{ color }}>
          {score}
        </span>
        <span className="text-xs text-slate-500">/ 100</span>
      </div>
    </div>
  );
}
