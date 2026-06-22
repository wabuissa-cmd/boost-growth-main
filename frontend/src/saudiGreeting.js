/** Greeting by hour in Saudi Arabia (Asia/Riyadh). */
export function saudiHour() {
  const hourStr = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Riyadh",
    hour: "numeric",
    hour12: false,
  }).format(new Date());
  return parseInt(hourStr, 10);
}

export function saudiGreetingPrefix() {
  const h = saudiHour();
  if (h < 12) return "صباح الخير";
  return "مساء الخير";
}

export function saudiGreeting(name) {
  const first = (name || "").trim();
  return first ? `${saudiGreetingPrefix()}، ${first}` : saudiGreetingPrefix();
}

export function saudiDateString() {
  return new Intl.DateTimeFormat("ar-SA", {
    timeZone: "Asia/Riyadh",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
}
