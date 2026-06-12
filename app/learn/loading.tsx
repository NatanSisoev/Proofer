import { SkelLine, SkelPanel } from "@/app/components/Skeleton";

export default function Loading() {
  return (
    <div className="wrap">
      <div className="breadcrumb">
        <SkelLine width={160} />
      </div>
      <div className="skel skel-title" style={{ marginTop: 4, marginBottom: 4 }} />
      <div className="skel skel-tag" style={{ marginBottom: 20, width: "100%", maxWidth: 640 }} />
      <SkelPanel lines={4} title={false} />
    </div>
  );
}
