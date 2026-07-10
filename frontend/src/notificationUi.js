import {
  Bell,
  CalendarBlank,
  ClipboardText,
  GraduationCap,
  ListChecks,
  ShoppingBag,
  UserCircle,
  Warning,
} from "@phosphor-icons/react";

/** Icon + colors for in-app notification rows */
export function notificationMeta(type) {
  const t = (type || "").toLowerCase();
  if (t.includes("leave")) {
    return { Icon: CalendarBlank, bg: "#EAF0F3", color: "#375568" };
  }
  if (t.includes("request")) {
    return { Icon: ListChecks, bg: "#FAF0D1", color: "#6B5218" };
  }
  if (t.includes("unprepared")) {
    return { Icon: ClipboardText, bg: "#F8EBE7", color: "#8A3F27" };
  }
  if (t.includes("parent_cancel")) {
    return { Icon: Warning, bg: "#FCE0E8", color: "#8B3A55" };
  }
  if (t.includes("schedule")) {
    return { Icon: CalendarBlank, bg: "var(--bg-warm, #F4EFE6)", color: "var(--brand-dark, #2F4A35)" };
  }
  if (t.includes("purchase")) {
    return { Icon: ShoppingBag, bg: "#F0E9D8", color: "#6B5218" };
  }
  if (t.includes("certificate")) {
    return { Icon: GraduationCap, bg: "#EAF0F3", color: "#375568" };
  }
  if (t.includes("contract") || t.includes("evaluation") || t.includes("probation") || t.includes("low_leave")) {
    return { Icon: UserCircle, bg: "#F0E9D8", color: "#5C6853" };
  }
  return { Icon: Bell, bg: "var(--bg-warm, #F4EFE6)", color: "var(--brand, #5C6B52)" };
}
