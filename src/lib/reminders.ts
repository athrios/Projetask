export type ReminderUnit = "minutes" | "hours" | "days";

export interface ReminderInput {
  offset_value: number;
  offset_unit: ReminderUnit;
  notify_in_app: boolean;
  notify_email: boolean;
}

export interface ReminderRow extends ReminderInput {
  id: string;
  task_id: string;
  workspace_id: string;
  user_id: string;
  reminder_at: string;
  status: "pending" | "sent" | "cancelled";
  email_sent_at: string | null;
  in_app_created_at: string | null;
}

export const REMINDER_PRESETS: Array<{
  label: string;
  offset_value: number;
  offset_unit: ReminderUnit;
}> = [
  { label: "Na hora", offset_value: 0, offset_unit: "minutes" },
  { label: "5 minutos antes", offset_value: 5, offset_unit: "minutes" },
  { label: "15 minutos antes", offset_value: 15, offset_unit: "minutes" },
  { label: "30 minutos antes", offset_value: 30, offset_unit: "minutes" },
  { label: "1 hora antes", offset_value: 1, offset_unit: "hours" },
  { label: "1 dia antes", offset_value: 1, offset_unit: "days" },
];

const UNIT_MS: Record<ReminderUnit, number> = {
  minutes: 60_000,
  hours: 3_600_000,
  days: 86_400_000,
};

/**
 * Computes the reminder_at timestamp (ISO) given a due date (yyyy-mm-dd),
 * an optional due_time (HH:mm[:ss]) and an offset. Treats the date as
 * America/Sao_Paulo local time (offset -03:00).
 */
export function computeReminderAt(
  dueDate: string,
  dueTime: string | null,
  offset: number,
  unit: ReminderUnit,
): string {
  const time = dueTime ?? "09:00:00";
  const padded = time.length === 5 ? `${time}:00` : time;
  const base = new Date(`${dueDate}T${padded}-03:00`);
  const ms = base.getTime() - offset * UNIT_MS[unit];
  return new Date(ms).toISOString();
}

export function describeReminder(r: { offset_value: number; offset_unit: ReminderUnit }): string {
  if (r.offset_value === 0) return "Na hora";
  const unit =
    r.offset_unit === "minutes"
      ? r.offset_value === 1
        ? "minuto"
        : "minutos"
      : r.offset_unit === "hours"
        ? r.offset_value === 1
          ? "hora"
          : "horas"
        : r.offset_value === 1
          ? "dia"
          : "dias";
  return `${r.offset_value} ${unit} antes`;
}
