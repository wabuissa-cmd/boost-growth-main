import { useState } from "react";
import {
  House, CalendarBlank, ClipboardText, Users, FileText,
  MagnifyingGlass, CheckCircle, Clock, Sparkle,
} from "@phosphor-icons/react";
import "../designPreview.css";

const MOCK_CLIENTS = [
  { id: 1, name: "Abdulrahman", file: "042", service: "SS", school: "Al Yasmin", hours: "2h", color: "#7A8A6A", prep: 85 },
  { id: 2, name: "Sara", file: "018", service: "HS", school: "Home", hours: "1.5h", color: "#6B9E9A", prep: 60 },
  { id: 3, name: "Omar", file: "063", service: "SS", school: "Green Valley", hours: "2h", color: "#C9A84C", prep: 40 },
  { id: 4, name: "Layla", file: "027", service: "HS", school: "Home", hours: "2h", color: "#8B7AA8", prep: 100 },
];

function PrepRing({ value }) {
  const r = 46;
  const c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;
  return (
    <div className="dp-ring">
      <svg viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="8" />
        <circle
          cx="60" cy="60" r={r} fill="none"
          stroke="#C9A84C" strokeWidth="8" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={offset}
        />
      </svg>
      <div className="dp-ring-center">
        <div className="dp-ring-val">{value}%</div>
        <div className="dp-ring-lbl">Prepared</div>
      </div>
    </div>
  );
}

export default function DesignPreview() {
  const [selected, setSelected] = useState(MOCK_CLIENTS[0]);

  return (
    <div className="design-preview">
      <div className="dp-banner">
        <Sparkle size={18} weight="fill" />
        Design preview only — Preparation page concept with Thmanyah font, warm beige + olive palette.
      </div>

      <div className="dp-layout">
        <aside className="dp-sidebar">
          <div className="dp-profile">
            <div className="dp-avatar">R</div>
            <div className="dp-profile-name">Ms. Razan</div>
            <div className="dp-profile-role">Speech Therapist</div>
          </div>
          <nav className="dp-nav">
            <button type="button" className="dp-nav-item"><House size={20} weight="regular" /> Home</button>
            <button type="button" className="dp-nav-item"><CalendarBlank size={20} weight="regular" /> Schedule</button>
            <button type="button" className="dp-nav-item active"><ClipboardText size={20} weight="fill" /> Preparation</button>
            <button type="button" className="dp-nav-item"><Users size={20} weight="regular" /> Clients</button>
            <button type="button" className="dp-nav-item"><FileText size={20} weight="regular" /> Requests</button>
          </nav>
        </aside>

        <main className="dp-main">
          <div className="dp-topbar">
            <div className="dp-greeting">
              <h1>Today&apos;s Preparation</h1>
              <p>Thursday, 5 June · 4 clients scheduled</p>
            </div>
            <label className="dp-search">
              <MagnifyingGlass size={18} />
              <input placeholder="Search client or file no…" readOnly />
            </label>
          </div>

          <div className="dp-stats">
            <div className="dp-stat-card">
              <div className="dp-stat-icon" style={{ background: "#E5EBE1", color: "#3D4F3A" }}>
                <ClipboardText size={22} weight="fill" />
              </div>
              <div>
                <div className="dp-stat-value">4</div>
                <div className="dp-stat-label">Sessions today</div>
              </div>
            </div>
            <div className="dp-stat-card">
              <div className="dp-stat-icon" style={{ background: "#F0E4C8", color: "#6B5218" }}>
                <CheckCircle size={22} weight="fill" />
              </div>
              <div>
                <div className="dp-stat-value">2</div>
                <div className="dp-stat-label">Prep complete</div>
              </div>
            </div>
            <div className="dp-stat-card">
              <div className="dp-stat-icon" style={{ background: "#EAF0F3", color: "#375568" }}>
                <Clock size={22} weight="fill" />
              </div>
              <div>
                <div className="dp-stat-value">6.5h</div>
                <div className="dp-stat-label">Total hours</div>
              </div>
            </div>
          </div>

          <div className="dp-content">
            <div className="dp-client-list">
              {MOCK_CLIENTS.map(c => (
                <div
                  key={c.id}
                  className={`dp-client-card${selected.id === c.id ? " selected" : ""}`}
                  onClick={() => setSelected(c)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => e.key === "Enter" && setSelected(c)}
                >
                  <div className="dp-client-avatar" style={{ background: c.color }}>{c.name[0]}</div>
                  <div>
                    <div className="dp-client-name">{c.name}</div>
                    <div className="dp-client-meta">File #{c.file} · {c.school}</div>
                  </div>
                  <span className="dp-pill">{c.service} · {c.hours}</span>
                  <button type="button" className="dp-prep-btn">Prepare</button>
                </div>
              ))}
            </div>

            <aside className="dp-detail">
              <div>
                <div className="dp-detail-head">{selected.name}</div>
                <div className="dp-detail-sub">File #{selected.file} · {selected.service} · {selected.school}</div>
              </div>
              <div className="dp-ring-wrap">
                <PrepRing value={selected.prep} />
              </div>
              <div className="dp-detail-rows">
                <div className="dp-detail-row"><span>Goals reviewed</span><span>3 / 4</span></div>
                <div className="dp-detail-row"><span>Materials ready</span><span>Yes</span></div>
                <div className="dp-detail-row"><span>Last session</span><span>2 Jun</span></div>
                <div className="dp-detail-row"><span>Next slot</span><span>10:00 AM</span></div>
              </div>
              <button type="button" className="dp-detail-cta">Open preparation notes</button>
            </aside>
          </div>
        </main>
      </div>
    </div>
  );
}
