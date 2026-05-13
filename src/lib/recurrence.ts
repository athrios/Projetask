export type RecurrenceType = "daily" | "weekly" | "monthly";

export const RECURRENCE_OPTIONS: { value: RecurrenceType; label: string }[] = [
  { value: "daily", label: "Diariamente" },
  { value: "weekly", label: "Semanalmente" },
  { value: "monthly", label: "Mensalmente" },
];

/** Returns ISO date (YYYY-MM-DD) for the next occurrence, or null if past end. */
export const nextOccurrenceDate = (
  baseISO: string,
  type: RecurrenceType,
  interval: number,
  endISO?: string | null,
): string | null => {
  const d = new Date(baseISO + "T00:00:00");
  if (type === "daily") d.setDate(d.getDate() + interval);
  if (type === "weekly") d.setDate(d.getDate() + interval * 7);
  if (type === "monthly") d.setMonth(d.getMonth() + interval);
  const iso = d.toISOString().slice(0, 10);
  if (endISO && iso > endISO) return null;
  return iso;
};

export const addDaysISO = (baseISO: string, days: number): string => {
  const d = new Date(baseISO + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};
