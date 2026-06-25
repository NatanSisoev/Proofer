export default function Loading() {
  return (
    <div className="wrap">
      <div className="page-top">
        <div style={{ height: 40, background: "var(--panel)", borderRadius: 8, marginBottom: 10 }} />
        <div style={{ height: 20, background: "var(--panel)", borderRadius: 8, width: 200 }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
        {Array(6).fill(0).map((_, i) => (
          <div
            key={i}
            style={{
              height: 160,
              background: "var(--panel)",
              borderRadius: 8,
            }}
          />
        ))}
      </div>
    </div>
  );
}
