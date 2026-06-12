export default function Loading() {
  return (
    <div className="wrap" style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 48px)", paddingBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
        <div>
          <div className="skel skel-title" />
          <div className="skel skel-tag" style={{ marginTop: 4 }} />
        </div>
      </div>
      <div className="skel" style={{ flex: 1, minHeight: 500, borderRadius: 10 }} />
    </div>
  );
}
