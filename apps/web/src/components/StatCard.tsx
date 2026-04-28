type Props = {
  label: string;
  value: string;
  accent: "ocean" | "ember" | "ink";
};

const accentMap = {
  ocean: "from-ocean/20 to-white",
  ember: "from-ember/20 to-white",
  ink: "from-ink/15 to-white"
};

export function StatCard({ label, value, accent }: Props) {
  return (
    <div className={`rounded-[28px] bg-gradient-to-br ${accentMap[accent]} p-5 shadow-panel`}>
      <p className="text-sm uppercase tracking-[0.24em] text-slate-500">{label}</p>
      <p className="mt-4 font-display text-4xl font-bold text-ink">{value}</p>
    </div>
  );
}

