import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import WaitingPage from "./waiting/WaitingPage";

export default function Waiting() {
  const [sp, setSp] = useSearchParams();

  const view = useMemo(() => {
    const raw = (sp.get("view") || "").toLowerCase();
    return raw === "school" ? "school" : "intake";
  }, [sp]);

  const setView = (next) => {
    const n = next === "school" ? "school" : "intake";
    const nextParams = new URLSearchParams(sp);
    nextParams.set("view", n);
    if (n === "intake" && !nextParams.get("tab")) nextParams.set("tab", "pre");
    setSp(nextParams, { replace: true });
  };

  return <WaitingPage mode={view} onModeChange={setView} />;
}
