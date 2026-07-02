import "../stepperLayout.css";

export default function VerticalStepper({ steps, current, variant = "default" }) {
  const portal = variant === "portal";
  return (
    <nav className={`v-stepper${portal ? " v-stepper--portal" : ""}`} aria-label="Progress">
      {steps.map((s, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        return (
          <div key={s.id || s.label} className={`v-step${done ? " done" : ""}${active ? " active" : ""}`}>
            <div className="v-step-marker">{done ? "✓" : n}</div>
            <div className="v-step-text">
              <div className="v-step-label">{s.label}</div>
              {s.hint && <div className="v-step-hint">{s.hint}</div>}
            </div>
          </div>
        );
      })}
    </nav>
  );
}
