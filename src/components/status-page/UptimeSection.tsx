export interface UptimeSectionProps {
  uptime: {
    day: number;
    week: number;
    month: number;
  };
}

export function UptimeSection({ uptime }: UptimeSectionProps) {
  return (
    <div className="border border-[#333] bg-[#111] p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wider mb-4">Uptime</h2>
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: '24 hours', value: uptime.day },
          { label: '7 days', value: uptime.week },
          { label: '30 days', value: uptime.month },
        ].map(({ label, value }) => (
          <div key={label} className="text-center">
            <div className="text-2xl font-bold text-green-400">{value}%</div>
            <div className="text-xs text-[#777]">{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
