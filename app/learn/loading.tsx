import { SkelLine, SkelPanel } from "@/app/components/Skeleton";

export default function Loading() {
  return (
    <div className="wrap">
      <div className="breadcrumb">
        <SkelLine width={160} />
      </div>
      <div className="skel skel-title" style={{ marginTop: 4, marginBottom: 4 }} />
      <div className="skel skel-tag skel-learn-tag" />
      <SkelPanel lines={4} title={false} />
    </div>
  );
}
