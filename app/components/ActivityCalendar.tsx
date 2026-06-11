"use client";

type Day = { date: string; count: number };

const DAYS = ["", "Mon", "", "Wed", "", "Fri", ""];

function cellColor(count: number): string {
  if (count === 0) return "var(--bg-soft)";
  if (count <= 2) return "#C5DCC0";
  if (count <= 5) return "#9DC499";
  if (count <= 10) return "#6DAA68";
  return "#3D7A38";
}

export default function ActivityCalendar({ data }: { data: Day[] }) {
  // Group into 12 weeks of 7 days
  const weeks: Day[][] = [];
  for (let w = 0; w < 12; w++) {
    weeks.push(data.slice(w * 7, w * 7 + 7));
  }

  const total = data.reduce((s, d) => s + d.count, 0);
  const activeDays = data.filter((d) => d.count > 0).length;

  return (
    <div>
      <div style={{ display: "flex", gap: 3, alignItems: "flex-start" }}>
        {/* Day labels */}
        <div style={{ display: "flex", flexDirection: "column", gap: 3, paddingTop: 16 }}>
          {DAYS.map((d, i) => (
            <div key={i} style={{ height: 12, fontSize: 9, color: "var(--muted)", lineHeight: "12px", width: 20, textAlign: "right" }}>
              {d}
            </div>
          ))}
        </div>
        {/* Weeks */}
        <div style={{ display: "flex", gap: 3, flex: 1, overflow: "hidden" }}>
          {weeks.map((week, wi) => {
            const firstDay = week[0];
            const month = firstDay ? new Date(firstDay.date + "T12:00:00").toLocaleString("default", { month: "short" }) : "";
            const isFirstOfMonth = firstDay && new Date(firstDay.date + "T12:00:00").getDate() <= 7;
            return (
              <div key={wi} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <div style={{ height: 14, fontSize: 9, color: "var(--muted)", lineHeight: "14px", whiteSpace: "nowrap" }}>
                  {isFirstOfMonth ? month : ""}
                </div>
                {week.map((day, di) => (
                  <div
                    key={di}
                    title={`${day.date}: ${day.count} attempt${day.count !== 1 ? "s" : ""}`}
                    style={{
                      width: 12, height: 12,
                      borderRadius: 2,
                      background: cellColor(day.count),
                      border: "1px solid var(--border)",
                      transition: "transform 0.1s",
                      cursor: day.count > 0 ? "default" : undefined,
                    }}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ display: "flex", gap: 16, marginTop: 8, alignItems: "center" }}>
        <span className="muted small">{total} attempts over {activeDays} active days in the last 12 weeks</span>
        <div style={{ display: "flex", gap: 3, alignItems: "center", marginLeft: "auto" }}>
          <span className="muted small">less</span>
          {[0, 2, 5, 8, 12].map((n) => (
            <div key={n} style={{ width: 10, height: 10, borderRadius: 2, background: cellColor(n) }} />
          ))}
          <span className="muted small">more</span>
        </div>
      </div>
    </div>
  );
}
