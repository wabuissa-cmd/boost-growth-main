import { Navigate, useSearchParams } from "react-router-dom";

/** Legacy /intake URL → intake waiting queue (preserves ?tab=post). */
export default function Intake() {
  const [searchParams] = useSearchParams();
  const tab = searchParams.get("tab");
  const suffix = tab === "post" ? "?tab=post" : "";
  return <Navigate to={`/waiting/intake${suffix}`} replace />;
}
