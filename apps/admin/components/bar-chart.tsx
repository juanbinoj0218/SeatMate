// Single-series vertical bar chart with hover/focus values and a table view.

export type Bar = { key: string; value: number; label: string; tooltip: string };

export default function BarChart({
  bars,
  labelEvery = 1,
  barClass = "bg-emerald-500",
}: {
  bars: Bar[];
  labelEvery?: number;
  barClass?: string;
}) {
  const top = Math.max(4, Math.ceil(Math.max(0, ...bars.map((bar) => bar.value)) / 4) * 4);

  return (
    <div>
      <div className="relative h-52">
        {[0, 0.5, 1].map((fraction) => (
          <div key={fraction} className="absolute inset-x-0 border-t border-gray-100" style={{ bottom: `${fraction * 100}%` }}>
            <span className="absolute -top-2.5 right-0 bg-white pl-1 text-[11px] tabular-nums text-gray-400">
              {Math.round(top * fraction).toLocaleString()}
            </span>
          </div>
        ))}

        <div className="absolute inset-0 right-10 flex items-end gap-[2px]">
          {bars.map((bar) => (
            <div key={bar.key} className="group relative flex h-full flex-1 items-end justify-center">
              <div
                tabIndex={0}
                aria-label={bar.tooltip}
                className={`w-full max-w-9 rounded-t-[4px] outline-none transition-opacity group-hover:opacity-80 focus-visible:ring-2 focus-visible:ring-[#101811] ${barClass}`}
                style={{ height: `${Math.max(bar.value > 0 ? 2 : 0.5, (bar.value / top) * 100)}%` }}
              />
              <span className="pointer-events-none absolute bottom-full z-10 mb-2 hidden whitespace-nowrap rounded-lg bg-[#101811] px-2.5 py-1.5 text-xs font-medium text-white shadow-lg group-focus-within:block group-hover:block">
                {bar.tooltip}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="mr-10 mt-2 flex gap-[2px]" aria-hidden="true">
        {bars.map((bar, index) => (
          <span key={bar.key} className="flex-1 whitespace-nowrap text-center text-[11px] tabular-nums text-gray-400">
            {index % labelEvery === 0 ? bar.label : ""}
          </span>
        ))}
      </div>

      <details className="mt-4 text-sm">
        <summary className="cursor-pointer text-gray-500 hover:text-[#101811]">View as table</summary>
        <table className="mt-3 w-full text-left">
          <tbody>
            {bars.map((bar) => (
              <tr key={bar.key} className="border-t border-gray-100">
                <td className="py-1.5 text-gray-500">{bar.label}</td>
                <td className="py-1.5 text-right tabular-nums">{bar.value.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
