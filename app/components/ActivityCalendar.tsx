type Day = { date: string; count: number };

const DAYS = ["", "Mon", "", "Wed", "", "Fri", ""];

function cellColor(count: number): string {
  if (count === 0) return "var(--bg-soft)";
  if (count <= 2) return "var(--cal-1)";
  if (count <= 5) return "var(--cal-2)";
  if (count <= 10) return "var(--cal-3)";
  return "var(--cal-4)";
}

export default function ActivityCalendar({ data }: { data: Day[] }) {
  const weeks: Day[][] = [];
  for (let w = 0; w < 12; w++) {
    weeks.push(data.slice(w * 7, w * 7 + 7));
  }

  const total = data.reduce((s, d) => s + d.count, 0);
  const activeDays = data.filter((d) => d.count > 0).length;

  return (
    <div>
      <div className="cal-grid">
        <div className="cal-day-labels">
          {DAYS.map((d, i) => (
            <div key={i} className="cal-day-label">{d}</div>
          ))}
        </div>
        <div className="cal-weeks">
          {weeks.map((week, wi) => {
            const firstDay = week[0];
            const month = firstDay ? new Date(firstDay.date + "T12:00:00").toLocaleString("default", { month: "short" }) : "";
            const isFirstOfMonth = firstDay && new Date(firstDay.date + "T12:00:00").getDate() <= 7;
            return (
              <div key={wi} className="cal-week">
                <div className="cal-month-label">
                  {isFirstOfMonth ? month : ""}
                </div>
                {week.map((day, di) => (
                  <div
                    key={di}
                    title={`${day.date}: ${day.count} attempt${day.count !== 1 ? "s" : ""}`}
                    className="cal-cell"
                    style={{
                      background: cellColor(day.count),
                      cursor: day.count > 0 ? "default" : undefined,
                    }}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>
      <div className="cal-footer">
        <span className="muted small">{total} attempts over {activeDays} active days in the last 12 weeks</span>
        <div className="cal-legend">
          <span className="muted small">less</span>
          {[0, 2, 5, 8, 12].map((n) => (
            <div key={n} className="cal-legend-cell" style={{ background: cellColor(n) }} />
          ))}
          <span className="muted small">more</span>
        </div>
      </div>
    </div>
  );
}
