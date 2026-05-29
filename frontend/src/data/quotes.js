// Daily rotating quotes — same quote for all staff on a given day (day-of-year index).
export const QUOTES = [
  { text: "Every child is a different kind of flower, and all together make this world a beautiful garden.", by: "Boost Growth" },
  { text: "Progress is progress, no matter how small.", by: "Boost Growth" },
  { text: "The work you do today plants seeds for tomorrow's growth.", by: "Boost Growth" },
  { text: "Patience, consistency, and love — the foundation of every breakthrough.", by: "Boost Growth" },
  { text: "You are making a difference in a child's world today.", by: "Boost Growth" },
  { text: "Small steps every day lead to big changes over time.", by: "Boost Growth" },
  { text: "Your dedication shapes futures.", by: "Boost Growth" },
  { text: "Behind every thriving child is a dedicated team.", by: "Boost Growth" },
  { text: "Growth happens one session at a time.", by: "Boost Growth" },
  { text: "You bring hope and progress to every family you serve.", by: "Boost Growth" },
  { text: "Today's effort is tomorrow's milestone.", by: "Boost Growth" },
  { text: "Each child's journey is unique — thank you for honoring theirs.", by: "Boost Growth" },
  { text: "Excellence is not a destination; it's a continuous journey.", by: "Boost Growth" },
  { text: "Your compassion makes all the difference.", by: "Boost Growth" },
];

export function quoteOfTheDay() {
  const start = new Date(new Date().getFullYear(), 0, 0);
  const diff = Date.now() - start.getTime();
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
  return QUOTES[dayOfYear % QUOTES.length];
}
