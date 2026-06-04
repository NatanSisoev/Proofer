import Link from "next/link";
import PracticeSession from "@/app/components/PracticeSession";
import { HAS_KEY } from "@/lib/llm";

export const dynamic = "force-dynamic";

export default async function LearnPage({ searchParams }: { searchParams: Promise<{ node?: string }> }) {
  const { node } = await searchParams;
  return (
    <div className="wrap">
      <div className="breadcrumb">
        <Link href="/">← map</Link> · practice
      </div>
      <h1 style={{ marginTop: 4, marginBottom: 4 }}>Practice</h1>
      <p className="muted" style={{ marginTop: 0, maxWidth: 640 }}>
        You&apos;ll be given a problem on a concept you&apos;re ready for. Answer in your own words — state it, prove it,
        find a counterexample. The tutor diagnoses the <em>specific</em> gap and moves your mastery accordingly.
        {!HAS_KEY && " (Running in demo mode — set ANTHROPIC_API_KEY for real AI problems and grading.)"}
      </p>
      <PracticeSession initialNodeId={node} />
    </div>
  );
}
