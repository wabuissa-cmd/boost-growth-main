export default function CreativeSection({ title, subtitle, action, children, className = "" }) {
  return (
    <section className={`dash-section ${className}`.trim()}>
      {(title || action) && (
        <div className="dash-section-head">
          <div>
            {title && <h2 className="dash-section-title">{title}</h2>}
            {subtitle && <p className="dash-section-sub">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
