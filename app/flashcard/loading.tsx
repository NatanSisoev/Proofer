import { SkelPanel } from "@/app/components/Skeleton";

export default function Loading() {
  return (
    <div className="wrap" style={{ maxWidth: 700 }}>
      <SkelPanel lines={6} />
    </div>
  );
}
