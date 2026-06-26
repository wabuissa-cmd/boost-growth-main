import { MapPin } from "@phosphor-icons/react";
import LocationLink from "./LocationLink";
import { formatLocationLabel } from "../mapsUtils";

const SERVICE_PILL = {
  SS: { background: "#E5EBE1", color: "#3D4F35" },
  HS: { background: "#EAF0F3", color: "#375568" },
};

function LocationItem({ service, address }) {
  const raw = (address || "").trim();
  if (!raw) return null;
  const pill = SERVICE_PILL[service] || SERVICE_PILL.HS;
  const label = formatLocationLabel(raw) || raw;

  return (
    <div className="location-item">
      {service && (
        <span className="location-item-service pill text-[10px] py-0.5 px-2 shrink-0" style={pill}>
          {service}
        </span>
      )}
      <div className="location-item-body">
        <LocationLink address={raw} className="location-item-address">
          {label}
        </LocationLink>
        <LocationLink address={raw} className="location-maps-btn" aria-label={`Open ${label} in Maps`}>
          <MapPin size={16} weight="duotone" />
          Open in Maps
        </LocationLink>
      </div>
    </div>
  );
}

/** Touch-friendly list of client locations with formatted labels and Maps links. */
export default function LocationList({ locations = [], emptyMessage = "No locations on file" }) {
  const items = (locations || []).filter(l => (l.address || "").trim());
  if (!items.length) {
    return (
      <div className="location-list-empty text-sm py-6 text-center" style={{ color: "#8B9E7A" }}>
        {emptyMessage}
      </div>
    );
  }
  return (
    <div className="location-list">
      {items.map((l, i) => (
        <LocationItem key={`${l.service || "loc"}-${i}`} service={l.service} address={l.address} />
      ))}
    </div>
  );
}
