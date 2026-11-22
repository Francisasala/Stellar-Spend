export interface UptimeSectionProps {
  uptime: {
    day: number;
    week: number;
    month: number;
  };
}

export function UptimeSection({ uptime }: UptimeSectionProps) {
  return (
    <section
      className="border border-[#333] bg-[#111] p-6"
      aria-labelledby="uptime-section-heading"
    >
      <h2
        id="uptime-section-heading"
        className="text-sm font-semibold uppercase tracking-wider mb-4"
      >
        Uptime
      </h2>
      <div className="grid grid-cols-3 gap-4" role="list">
        {[
          { label: '24 hours', value: uptime.day },
          { label: '7 days', value: uptime.week },
          { label: '30 days', value: uptime.month },
        ].map(({ label, value }) => (
          <div key={label} className="text-center" role="listitem">
            <div
              className="text-2xl font-bold text-green-400"
              aria-label={`${label} uptime: ${value} percent`}
            >
              {value}%
            </div>
            <div className="text-xs text-[#777]" aria-hidden="true">
              {label}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
