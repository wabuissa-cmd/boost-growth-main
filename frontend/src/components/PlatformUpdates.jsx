import { Megaphone } from "@phosphor-icons/react";

export default function PlatformUpdates({ items = [] }) {
  return (
    <div className="updates-panel" data-testid="platform-updates">
      <div className="updates-panel-title">
        <Megaphone size={18} weight="duotone" style={{ color: "#D4A64A" }} />
        Platform Updates
      </div>
      {items.length === 0 ? (
        <p className="text-xs" style={{ color: "#8B9E7A" }}>No updates posted yet.</p>
      ) : (
        items.slice(0, 5).map(u => (
          <div key={u.id} className="update-item">
            {u.date && <div className="update-date">{u.date}</div>}
            <div className="update-title">{u.title}</div>
            {u.body && <div className="update-body">{u.body}</div>}
          </div>
        ))
      )}
    </div>
  );
}
