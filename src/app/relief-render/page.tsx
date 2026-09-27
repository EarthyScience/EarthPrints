import { notFound } from "next/navigation";
import { ReliefRenderer } from "./ReliefRenderer";

// Used by scripts/relief-tiles to pre-render relief tiles. Dev only.
export default function ReliefRenderPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <ReliefRenderer />;
}
