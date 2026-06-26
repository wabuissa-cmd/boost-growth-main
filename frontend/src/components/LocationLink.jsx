import { getMapsHref, formatLocationLabel } from "../mapsUtils";

/** Touch-friendly link that opens Google Maps on mobile and desktop. */
export default function LocationLink({
  address,
  href,
  className = "",
  children,
  onClick,
  style,
}) {
  const src = (href || address || "").trim();
  const mapsHref = getMapsHref(src);
  if (!mapsHref) {
    return <span className={className} style={style}>{children || address || "—"}</span>;
  }
  const label = children ?? (formatLocationLabel(src) || src);
  return (
    <a
      href={mapsHref}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      style={{ cursor: "pointer", touchAction: "manipulation", WebkitTapHighlightColor: "transparent", ...style }}
      onClick={onClick}
    >
      {label}
    </a>
  );
}
