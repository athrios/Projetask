import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Trash2, Download, Link2 } from "lucide-react";
import { toast } from "sonner";
import type { Task } from "./TasksPanel";

interface ScheduleItem {
  id: string;
  start_time: string;
  title: string;
  duration_minutes: number;
  position: number;
  task_date: string;
  status: "pendente" | "fazendo" | "feita" | "pulado";
  task_id: string | null;
}

interface Props {
  date: string;
  userId: string;
  tasks: Task[];
}

const STATUS_OPTIONS: { value: ScheduleItem["status"]; label: string }[] = [
  { value: "pendente", label: "Pendente" },
  { value: "fazendo", label: "Fazendo" },
  { value: "feita", label: "Concluído" },
  { value: "pulado", label: "Pulado" },
];

const statusColor: Record<ScheduleItem["status"], string> = {
  pendente: "bg-[hsl(var(--status-pendente-bg))] text-[hsl(var(--status-pendente))] hover:opacity-90",
  fazendo: "bg-[hsl(var(--status-fazendo-bg))] text-[hsl(var(--status-fazendo))] hover:opacity-90",
  feita: "bg-[hsl(var(--status-feita-bg))] text-[hsl(var(--status-feita))] hover:opacity-90",
  pulado: "bg-[hsl(var(--status-pulado-bg))] text-[hsl(var(--status-pulado))] hover:opacity-90",
};

const DURATIONS: number[] = [5, 10, 15, ...Array.from({ length: 15 }, (_, i) => 30 + i * 15)];

const PLACEHOLDER_COUNT = 10;
const DAY_START = "09:00";
const DAY_END_MIN = 18 * 60;

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
const fromMin = (n: number) => {
  const h = Math.floor((n % (24 * 60)) / 60);
  const m = n % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};
const fmt = (t: string) => t.slice(0, 5);

export const SchedulePanel = ({ date, userId, tasks }: Props) => {
  const [items, setItems] = useState<ScheduleItem[]>([]);

  const load = async () => {
    const { data, error } = await supabase
      .from("schedule_items")
      .select("*")
      .eq("task_date", date)
      .order("start_time", { ascending: true });
    if (error) return toast.error(error.message);
    setItems((data ?? []) as ScheduleItem[]);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const placeholders = useMemo(() => {
    const filled = items.length;
    const remaining = Math.max(0, PLACEHOLDER_COUNT - filled);
    const lastEnd =
      filled > 0
        ? toMin(items[items.length - 1].start_time.slice(0, 5)) +
          items[items.length - 1].duration_minutes
        : toMin(DAY_START);
    const slotSize = remaining > 0 ? Math.max(15, Math.round((DAY_END_MIN - lastEnd) / remaining / 15) * 15) : 60;
    return Array.from({ length: remaining }).map((_, i) => ({
      start: fromMin(lastEnd + i * slotSize),
      duration: 60,
    }));
  }, [items]);

  const insertItem = async (
    start: string,
    title: string,
    duration: number,
    taskId: string | null = null,
  ) => {
    const { error } = await supabase.from("schedule_items").insert({
      user_id: userId,
      task_date: date,
      start_time: start + ":00",
      title: title.trim(),
      duration_minutes: duration,
      position: items.length,
      task_id: taskId,
    });
    if (error) return toast.error(error.message);
    load();
  };

  const updateItem = async (id: string, patch: Partial<ScheduleItem>) => {
    const { error } = await supabase.from("schedule_items").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    // 2-way sync: if status changed and item is linked, mirror to the task
    if (patch.status !== undefined) {
      const it = items.find((i) => i.id === id);
      if (it?.task_id && patch.status !== "pulado") {
        await supabase
          .from("tasks")
          .update({
            status: patch.status,
            done: patch.status === "feita",
          })
          .eq("id", it.task_id);
      }
    }
    load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("schedule_items").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <section className="space-y-4">
      <header className="flex items-end justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Cronograma diário</h2>
          <p className="text-sm text-muted-foreground">
            Modelo de {DAY_START} às 18:00. Edite os horários e durações livremente.
          </p>
        </div>
      </header>

      <ul className="space-y-1 rounded-lg border bg-card divide-y">
        {items.map((it) => (
          <ScheduleRow
            key={it.id}
            start={fmt(it.start_time)}
            title={it.title}
            duration={it.duration_minutes}
            status={it.status}
            tasks={tasks}
            linkedTaskId={it.task_id}
            onChangeStart={(v) => updateItem(it.id, { start_time: v + ":00" })}
            onChangeTitle={(v) => updateItem(it.id, { title: v })}
            onChangeDuration={(v) => updateItem(it.id, { duration_minutes: v })}
            onChangeStatus={(v) => updateItem(it.id, { status: v })}
            onImport={(task) =>
              updateItem(it.id, { title: task.title, task_id: task.id, status: task.status })
            }
            onUnlink={() => updateItem(it.id, { task_id: null })}
            onRemove={() => remove(it.id)}
          />
        ))}
        {placeholders.map((p, i) => (
          <PlaceholderRow
            key={`p-${i}`}
            initialStart={p.start}
            initialDuration={p.duration}
            tasks={tasks}
            onCommit={(start, title, duration, taskId) =>
              insertItem(start, title, duration, taskId)
            }
          />
        ))}
      </ul>
    </section>
  );
};

interface RowProps {
  start: string;
  title: string;
  duration: number;
  status: ScheduleItem["status"];
  tasks: Task[];
  linkedTaskId: string | null;
  onChangeStart: (v: string) => void;
  onChangeTitle: (v: string) => void;
  onChangeDuration: (v: number) => void;
  onChangeStatus: (v: ScheduleItem["status"]) => void;
  onImport: (task: Task) => void;
  onUnlink: () => void;
  onRemove: () => void;
}

const ScheduleRow = ({
  start,
  title,
  duration,
  status,
  tasks,
  linkedTaskId,
  onChangeStart,
  onChangeTitle,
  onChangeDuration,
  onChangeStatus,
  onImport,
  onUnlink,
  onRemove,
}: RowProps) => {
  const [localTitle, setLocalTitle] = useState(title);
  useEffect(() => setLocalTitle(title), [title]);
  const end = fromMin(toMin(start) + duration);

  return (
    <li className="flex flex-wrap items-center gap-2 px-3 py-2 group">
      <Input
        type="time"
        value={start}
        onChange={(e) => onChangeStart(e.target.value)}
        className="h-8 text-xs w-[100px]"
      />
      <ImportButton tasks={tasks} onPick={onImport} />
      <div className="flex-1 min-w-[160px] flex items-center gap-1">
        {linkedTaskId && (
          <button
            onClick={onUnlink}
            title="Tarefa vinculada — clique para desvincular"
            className="text-[hsl(var(--status-fazendo))] hover:text-destructive transition shrink-0"
          >
            <Link2 className="h-3.5 w-3.5" />
          </button>
        )}
        <Input
          value={localTitle}
          onChange={(e) => setLocalTitle(e.target.value)}
          onBlur={() => localTitle !== title && onChangeTitle(localTitle)}
          placeholder="Tarefa..."
          className={`h-8 text-sm flex-1 ${status === "feita" ? "line-through text-muted-foreground" : ""}`}
        />
      </div>
      <Select value={String(duration)} onValueChange={(v) => onChangeDuration(Number(v))}>
        <SelectTrigger className="h-8 text-xs w-[90px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {DURATIONS.map((d) => (
            <SelectItem key={d} value={String(d)}>
              {d} min
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="text-xs text-muted-foreground hidden md:inline">→ {end}</span>
      <Select value={status} onValueChange={(v) => onChangeStatus(v as ScheduleItem["status"])}>
        <SelectTrigger
          className={`h-7 w-[110px] text-xs border-0 rounded-full ${statusColor[status]}`}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value} className="text-xs">
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <button
        onClick={onRemove}
        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition"
        aria-label="Remover"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </li>
  );
};

const PlaceholderRow = ({
  initialStart,
  initialDuration,
  tasks,
  onCommit,
}: {
  initialStart: string;
  initialDuration: number;
  tasks: Task[];
  onCommit: (start: string, title: string, duration: number, taskId: string | null) => void;
}) => {
  const [start, setStart] = useState(initialStart);
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState(initialDuration);
  useEffect(() => setStart(initialStart), [initialStart]);
  const end = fromMin(toMin(start) + duration);

  const commit = (t: string, taskId: string | null = null) => {
    if (t.trim()) onCommit(start, t, duration, taskId);
  };

  return (
    <li className="flex flex-wrap items-center gap-2 px-3 py-2 opacity-70 hover:opacity-100 transition">
      <Input
        type="time"
        value={start}
        onChange={(e) => setStart(e.target.value)}
        className="h-8 text-xs w-[100px]"
      />
      <ImportButton
        tasks={tasks}
        onPick={(task) => {
          setTitle(task.title);
          commit(task.title, task.id);
        }}
      />
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => commit(title)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            (e.target as HTMLInputElement).blur();
          }
        }}
        placeholder="—"
        className="h-8 text-sm flex-1 min-w-[160px] bg-transparent"
      />
      <Select value={String(duration)} onValueChange={(v) => setDuration(Number(v))}>
        <SelectTrigger className="h-8 text-xs w-[90px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {DURATIONS.map((d) => (
            <SelectItem key={d} value={String(d)}>
              {d} min
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="text-xs text-muted-foreground hidden md:inline">→ {end}</span>
      <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground w-[110px] text-center">
        Pendente
      </span>
      <span className="w-4" />
    </li>
  );
};

const ImportButton = ({ tasks, onPick }: { tasks: Task[]; onPick: (title: string) => void }) => (
  <DropdownMenu>
    <DropdownMenuTrigger
      className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-secondary hover:text-foreground transition"
      aria-label="Importar tarefa"
      title="Importar das tarefas isoladas"
    >
      <Download className="h-3.5 w-3.5" />
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start" className="max-h-64 overflow-auto w-56">
      {tasks.length === 0 && (
        <DropdownMenuItem disabled className="text-xs">
          Nenhuma tarefa isolada
        </DropdownMenuItem>
      )}
      {tasks.map((t) => (
        <DropdownMenuItem key={t.id} onSelect={() => onPick(t.title)} className="text-sm">
          {t.title}
        </DropdownMenuItem>
      ))}
    </DropdownMenuContent>
  </DropdownMenu>
);
