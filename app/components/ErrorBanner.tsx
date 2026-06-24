import { AlertCircle } from "./Icons";

/** Inline error banner — same visual weight as .save-notice, but for failures instead of confirmations. */
export default function ErrorBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="error-banner icon-label">
      <AlertCircle size={14} />
      <span>{children}</span>
    </div>
  );
}
