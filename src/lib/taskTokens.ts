export type TaskStatus =
  | "pendente"
  | "fazendo"
  | "aguardando"
  | "feita"
  | "cancelado";
export type ScheduleStatus = TaskStatus | "pulado";
export type Priority = "baixa" | "media" | "alta" | "urgente";

export type ProcessStatus =
  | "nao_iniciado"
  | "em_andamento"
  | "aguardando_cliente"
  | "aguardando_orgao"
  | "em_exigencia"
  | "concluido"
  | "cancelado";

export type RequestStatus =
  | "recebida"
  | "em_analise"
  | "convertida_tarefa"
  | "convertida_processo"
  | "concluida"
  | "arquivada";

export const TASK_STATUS: { value: TaskStatus; label: string }[] = [
  { value: "pendente", label: "Pendente" },
  { value: "fazendo", label: "Fazendo" },
  { value: "aguardando", label: "Aguardando" },
  { value: "feita", label: "Concluído" },
  { value: "cancelado", label: "Cancelado" },
];

export const SCHEDULE_STATUS: { value: ScheduleStatus; label: string }[] = [
  ...TASK_STATUS,
  { value: "pulado", label: "Pulado" },
];

export const PRIORITIES: { value: Priority; label: string }[] = [
  { value: "baixa", label: "Baixa" },
  { value: "media", label: "Média" },
  { value: "alta", label: "Alta" },
  { value: "urgente", label: "Urgente" },
];

export const PROCESS_STATUS: { value: ProcessStatus; label: string }[] = [
  { value: "nao_iniciado", label: "Não iniciado" },
  { value: "em_andamento", label: "Em andamento" },
  { value: "aguardando_cliente", label: "Aguardando cliente" },
  { value: "aguardando_orgao", label: "Aguardando órgão" },
  { value: "em_exigencia", label: "Em exigência" },
  { value: "concluido", label: "Concluído" },
  { value: "cancelado", label: "Cancelado" },
];

export const REQUEST_STATUS: { value: RequestStatus; label: string }[] = [
  { value: "recebida", label: "Recebida" },
  { value: "em_analise", label: "Em análise" },
  { value: "convertida_tarefa", label: "Convertida em tarefa" },
  { value: "convertida_processo", label: "Convertida em processo" },
  { value: "concluida", label: "Concluída" },
  { value: "arquivada", label: "Arquivada" },
];

export const statusPill: Record<ScheduleStatus, string> = {
  pendente: "bg-[hsl(var(--status-pendente-bg))] text-[hsl(var(--status-pendente))]",
  fazendo: "bg-[hsl(var(--status-fazendo-bg))] text-[hsl(var(--status-fazendo))]",
  aguardando: "bg-[hsl(var(--status-aguardando-bg))] text-[hsl(var(--status-aguardando))]",
  feita: "bg-[hsl(var(--status-feita-bg))] text-[hsl(var(--status-feita))]",
  cancelado: "bg-[hsl(var(--status-cancelado-bg))] text-[hsl(var(--status-cancelado))]",
  pulado: "bg-[hsl(var(--status-pulado-bg))] text-[hsl(var(--status-pulado))]",
};

export const priorityPill: Record<Priority, string> = {
  baixa: "bg-[hsl(var(--prio-baixa-bg))] text-[hsl(var(--prio-baixa))]",
  media: "bg-[hsl(var(--prio-media-bg))] text-[hsl(var(--prio-media))]",
  alta: "bg-[hsl(var(--prio-alta-bg))] text-[hsl(var(--prio-alta))]",
  urgente: "bg-[hsl(var(--prio-urgente-bg))] text-[hsl(var(--prio-urgente))]",
};

export const processStatusPill: Record<ProcessStatus, string> = {
  nao_iniciado: "bg-[hsl(var(--status-pendente-bg))] text-[hsl(var(--status-pendente))]",
  em_andamento: "bg-[hsl(var(--status-fazendo-bg))] text-[hsl(var(--status-fazendo))]",
  aguardando_cliente: "bg-[hsl(var(--status-aguardando-bg))] text-[hsl(var(--status-aguardando))]",
  aguardando_orgao: "bg-[hsl(var(--status-aguardando-bg))] text-[hsl(var(--status-aguardando))]",
  em_exigencia: "bg-[hsl(var(--prio-urgente-bg))] text-[hsl(var(--prio-urgente))]",
  concluido: "bg-[hsl(var(--status-feita-bg))] text-[hsl(var(--status-feita))]",
  cancelado: "bg-[hsl(var(--status-cancelado-bg))] text-[hsl(var(--status-cancelado))]",
};

export const requestStatusPill: Record<RequestStatus, string> = {
  recebida: "bg-[hsl(var(--status-pendente-bg))] text-[hsl(var(--status-pendente))]",
  em_analise: "bg-[hsl(var(--status-fazendo-bg))] text-[hsl(var(--status-fazendo))]",
  convertida_tarefa: "bg-[hsl(var(--status-aguardando-bg))] text-[hsl(var(--status-aguardando))]",
  convertida_processo: "bg-[hsl(var(--status-aguardando-bg))] text-[hsl(var(--status-aguardando))]",
  concluida: "bg-[hsl(var(--status-feita-bg))] text-[hsl(var(--status-feita))]",
  arquivada: "bg-[hsl(var(--status-cancelado-bg))] text-[hsl(var(--status-cancelado))]",
};
