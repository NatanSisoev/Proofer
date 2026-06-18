export default function Loading() {
  return (
    <div className="wrap graph-canvas">
      <div className="graph-header">
        <div>
          <div className="skel skel-title" />
          <div className="skel skel-tag" style={{ marginTop: 4 }} />
        </div>
      </div>
      <div className="skel" style={{ flex: 1, minHeight: 500, borderRadius: 10 }} />
    </div>
  );
}
