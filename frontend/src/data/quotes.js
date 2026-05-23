// 32 motivational quotes — warm, professional, suitable for therapists working with children.
// Rotated by day-of-year so every therapist sees the same quote on the same day.
export const QUOTES = [
  { text: "Every child blooms in their own time and in their own way.", by: "Boost Growth" },
  { text: "Behavior is communication. Listen with your whole heart.", by: "Therapist Wisdom" },
  { text: "Small steps, every day, build the brightest futures.", by: "Anonymous" },
  { text: "A child's progress is not always loud — but it is always meaningful.", by: "ABA Reflection" },
  { text: "Patience is the soil where growth takes root.", by: "Boost Growth" },
  { text: "You are someone's safe place today. That matters more than perfection.", by: "Therapist Note" },
  { text: "Connection before correction.", by: "Karyn Purvis" },
  { text: "Celebrate the smallest wins — they are the foundation of the biggest ones.", by: "Boost Growth" },
  { text: "Children don't need a perfect therapist; they need a present one.", by: "Therapist Wisdom" },
  { text: "Today's gentle effort becomes tomorrow's strong skill.", by: "Anonymous" },
  { text: "Every session is a seed. Some sprout fast, others take their time.", by: "Boost Growth" },
  { text: "Progress is not linear, and neither is healing.", by: "Therapist Reflection" },
  { text: "Meet the child where they are, then walk with them gently forward.", by: "ABA Principle" },
  { text: "You can't pour from an empty cup. Care for yourself, too.", by: "Anonymous" },
  { text: "Behind every breakthrough is a therapist who didn't give up.", by: "Boost Growth" },
  { text: "Repetition is not failure — it's how the brain learns to fly.", by: "Therapist Wisdom" },
  { text: "A calm voice can change the whole shape of a session.", by: "Anonymous" },
  { text: "Trust the process. Trust the child. Trust yourself.", by: "Boost Growth" },
  { text: "When in doubt, choose kindness — for the child, and for yourself.", by: "Therapist Note" },
  { text: "The work you do today echoes through a lifetime.", by: "Anonymous" },
  { text: "Notice the moment a child tries — that's where the magic begins.", by: "ABA Reflection" },
  { text: "Joy is a teaching tool. Use it generously.", by: "Boost Growth" },
  { text: "Rapport is built one smile, one moment, one session at a time.", by: "Therapist Wisdom" },
  { text: "Even on hard days, your presence is a gift.", by: "Anonymous" },
  { text: "Data tells us where we are. Heart tells us where to go.", by: "Boost Growth" },
  { text: "A child's resistance is information, not defiance.", by: "Therapist Reflection" },
  { text: "Be the steady in someone's storm today.", by: "Anonymous" },
  { text: "Skills generalize when relationships are warm.", by: "ABA Wisdom" },
  { text: "Today, focus on one win. That's enough.", by: "Boost Growth" },
  { text: "Children remember how you made them feel — long after they forget the lesson.", by: "Therapist Note" },
  { text: "Growth happens in the spaces between the lessons.", by: "Anonymous" },
  { text: "You don't need to be loud to change a life. Just consistent.", by: "Boost Growth" },
];

export function quoteOfTheDay() {
  const start = new Date(new Date().getFullYear(), 0, 0);
  const diff = Date.now() - start.getTime();
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
  return QUOTES[dayOfYear % QUOTES.length];
}
