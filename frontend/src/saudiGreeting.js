/** Time-of-day helpers using Saudi Arabia (Asia/Riyadh) timezone. */
const RIYADH = "Asia/Riyadh";

export function saudiHour() {
  const hourStr = new Intl.DateTimeFormat("en-US", {
    timeZone: RIYADH,
    hour: "numeric",
    hour12: false,
  }).format(new Date());
  return parseInt(hourStr, 10);
}

export function saudiGreetingPrefix() {
  const h = saudiHour();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export function saudiGreeting(name) {
  const first = (name || "").trim();
  return first ? `${saudiGreetingPrefix()}, ${first}` : saudiGreetingPrefix();
}

export function saudiGreetingParts(name) {
  return {
    prefix: saudiGreetingPrefix(),
    name: (name || "").trim() || null,
  };
}

/** Gregorian calendar date in English (portal standard). */
export function saudiDateString() {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: RIYADH,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    calendar: "gregory",
  }).format(new Date());
}
