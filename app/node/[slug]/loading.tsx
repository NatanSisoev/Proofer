import { SkelLine, SkelPanel } from "@/app/components/Skeleton";

export default function Loading() {
  return (
    <div className="wrap">
      <div className="breadcrumb">
        <SkelLine width={120} />
      </div>
      <div className="skel skel-title" style={{ width: 360, marginTop: 8, marginBottom: 4 }} />
      <div className="skel skel-tag" style={{ marginBottom: 20 }} />
      <div className="grid">
        <SkelPanel lines={8} />
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <SkelPanel lines={4} />
          <SkelPanel lines={4} />
        </div>
      </div>
    </div>
  );
}
