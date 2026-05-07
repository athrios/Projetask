export type TaskStatus = "pendente" | "fazendo" | "feita";
export type ScheduleStatus = TaskStatus | "pulado";
export type Priority = "baixa" | "media" | "alta";

export const TASK_STATUS: { value: TaskStatus; label: string }[] = [
  { value: "pendente", label: "Pendente" },
  { value: "fazendo", label: "Fazendo" },
  { value: "feita", label: "Concluído" },
];

export const SCHEDULE_STATUS: { value: ScheduleStatus; label: string }[] = [
  ...TASK_STATUS,
  { value: "pulado", label: "Pulado" },
];

export const PRIORITIES: { value: Priority; label: string }[] = [
  { value: "baixa", label: "Baixa" },
  { value: "media", label: "Média" },
  { value: "alta", label: "Alta" },
];

export const statusPill: Record<ScheduleStatus, string> = {
  pendente:
    "bg-[hsl(var(--status-pendente-bg))] text-[hsl(var(--status-pendente))]",
  fazendo:
    "bg-[hsl(var(--status-fazendo-bg))] text-[hsl(var(--status-fazendo))]",
  feita: "bg-[hsl(var(--status-feita-bg))] text-[hsl(var(--status-feita))]",
  pulado: "bg-[hsl(var(--status-pulado-bg))] text-[hsl(var(--status-pulado))]",
};

export const priorityPill: Record<Priority, string> = {
  baixa: "bg-[hsl(var(--prio-baixa-bg))] text-[hsl(var(--prio-baixa))]",
  media: "bg-[hsl(var(--prio-media-bg))] text-[hsl(var(--prio-media))]",
  alta: "bg-[hsl(var(--prio-alta-bg))] text-[hsl(var(--prio-alta))]",
};
