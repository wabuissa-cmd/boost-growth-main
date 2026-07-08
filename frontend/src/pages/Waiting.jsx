import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Buildings, ClipboardText } from "@phosphor-icons/react";
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
    setSp(nextParams, { replace: true });
  };

  return (
    <div className="page-enter">
      <div className="editorial-pill-row mb-3">
        <button
          type="button"
          onClick={() => setView("intake")}
          className={`editorial-pill${view === "intake" ? " is-active" : ""}`}
          data-testid="waiting-tab-intake"
        >
          <ClipboardText size={14} weight="duotone" /> Intake Waiting
        </button>
        <button
          type="button"
          onClick={() => setView("school")}
          className={`editorial-pill${view === "school" ? " is-active" : ""}`}
          data-testid="waiting-tab-school"
        >
          <Buildings size={14} weight="duotone" /> School Waiting
        </button>
      </div>

      <WaitingPage mode={view} />
    </div>
  );
}