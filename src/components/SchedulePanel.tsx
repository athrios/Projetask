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
import { useWorkspace } from "@/hooks/useWorkspace";
import type { Task } from "./TasksPanel";

interface ScheduleItem {
  id: string;
  start_time: string;
  title: string;
  duration_minutes: number;
  position: number;
  task_date: string;
  status: "pendente" | "fazendo" | "aguardando" | "feita" | "cancelado" | "pulado";
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
  { value: "aguardando", label: "Aguardando" },
  { value: "feita", label: "Concluído" },
  { value: "cancelado", label: "Cancelado" },
  { value: "pulado", label: "Pulado" },
];

const statusColor: Record<ScheduleItem["status"], string> = {
  pendente: "bg-[hsl(var(--status-pendente-bg))] text-[hsl(var(--status-pendente))] hover:opacity-90",
  fazendo: "bg-[hsl(var(--status-fazendo-bg))] text-[hsl(var(--status-fazendo))] hover:opacity-90",
  aguardando: "bg-[hsl(var(--status-aguardando-bg))] text-[hsl(var(--status-aguardando))] hover:opacity-90",
  feita: "bg-[hsl(var(--status-feita-bg))] text-[hsl(var(--status-feita))] hover:opacity-90",
  cancelado: "bg-[hsl(var(--status-cancelado-bg))] text-[hsl(var(--status-cancelado))] hover:opacity-90",
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
  const { workspaceId } = useWorkspace();
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [importableTasks, setImportableTasks] = useState<Task[]>([]);

  const load = async () => {
    if (!workspaceId) { setItems([]); return; }
    const { data, error } = await supabase
      .from("schedule_items")
      .select("*")
      .eq("task_date", date)
      .eq("workspace_id", workspaceId)
      .order("position", { ascending: true })
      .order("start_time", { ascending: true });
    if (error) return toast.error(error.message);
    setItems((data ?? []) as ScheduleItem[]);
  };

  const loadImportable = async () => {
    if (!workspaceId) { setImportableTasks([]); return; }
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("done", false)
      .not("status", "in", "(feita,cancelado)")
      .order("task_date", { ascending: true })
      .limit(200);
    if (error) return;
    setImportableTasks((data ?? []) as Task[]);
  };

  useEffect(() => {
    load();
    loadImportable();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, workspaceId]);

  // Realtime: tasks linked to schedule items should mirror status/title here automatically
  useEffect(() => {
    if (!workspaceId) return;
    const channel = supabase
      .channel(`schedule-tasks-${workspaceId}-${date}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "tasks", filter: `workspace_id=eq.${workspaceId}` },
        () => {
          load();
          loadImportable();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, date]);

  // Cascade: each row's start = base (first row) + sum of previous durations
  const computedStarts = useMemo(() => {
    const out: string[] = [];
    let cursor = items.length > 0 ? toMin(items[0].start_time.slice(0, 5)) : toMin(DAY_START);
    for (let i = 0; i < items.length; i++) {
      out.push(fromMin(cursor));
      cursor += items[i].duration_minutes;
    }
    return out;
  }, [items]);

  const lastEnd = useMemo(() => {
    if (items.length === 0) return toMin(DAY_START);
    return toMin(computedStarts[items.length - 1]) + items[items.length - 1].duration_minutes;
  }, [items, computedStarts]);

  const placeholders = useMemo(() => {
    const remaining = Math.max(0, PLACEHOLDER_COUNT - items.length);
    const slotSize = remaining > 0 ? Math.max(15, Math.round((DAY_END_MIN - lastEnd) / remaining / 15) * 15) : 60;
    return Array.from({ length: remaining }).map((_, i) => ({
      start: fromMin(lastEnd + i * slotSize),
      duration: 60,
    }));
  }, [items.length, lastEnd]);

  // Persist cascading start_times when items shape/duration/first-start changes.
  // Compares against DB values and patches only the diffs.
  const persistCascade = async (next: ScheduleItem[]) => {
    if (next.length === 0) return;
    let cursor = toMin(next[0].start_time.slice(0, 5));
    const updates: Promise<unknown>[] = [];
    const synced: ScheduleItem[] = [];
    for (let i = 0; i < next.length; i++) {
      const expected = fromMin(cursor) + ":00";
      const it = next[i];
      if (i > 0 && it.start_time.slice(0, 8) !== expected) {
        updates.push(
          Promise.resolve(supabase.from("schedule_items").update({ start_time: expected }).eq("id", it.id)),
        );
        synced.push({ ...it, start_time: expected });
      } else {
        synced.push(it);
      }
      cursor += it.duration_minutes;
    }
    if (updates.length) {
      setItems(synced);
      await Promise.all(updates);
    }
  };

  const insertItem = async (
    customStart: string,
    title: string,
    duration: number,
    taskId: string | null = null,
  ) => {
    // First row uses the user-provided start; subsequent rows append after lastEnd
    const start = items.length === 0 ? customStart : fromMin(lastEnd);
    const { error } = await supabase.from("schedule_items").insert({
      user_id: userId,
      task_date: date,
      start_time: start + ":00",
      title: title.trim(),
      duration_minutes: duration,
      position: items.length,
      task_id: taskId,
      workspace_id: workspaceId ?? undefined,
    } as never);
    if (error) return toast.error(error.message);
    await load();
  };

  const updateItem = async (id: string, patch: Partial<ScheduleItem>) => {
    // optimistic local update
    const optimistic = items.map((i) => (i.id === id ? { ...i, ...patch } as ScheduleItem : i));
    setItems(optimistic);

    const { error } = await supabase.from("schedule_items").update(patch).eq("id", id);
    if (error) {
      toast.error(error.message);
      return load();
    }
    if (patch.status !== undefined) {
      const it = items.find((i) => i.id === id);
      if (it?.task_id && patch.status !== "pulado") {
        await supabase
          .from("tasks")
          .update({ status: patch.status, done: patch.status === "feita" })
          .eq("id", it.task_id);
      }
    }
    // If duration or first row's start changed, cascade subsequent start_times
    if (patch.duration_minutes !== undefined || patch.start_time !== undefined) {
      await persistCascade(optimistic);
    }
  };

  const remove = async (id: string) => {
    const next = items.filter((i) => i.id !== id);
    setItems(next);
    const { error } = await supabase.from("schedule_items").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return load();
    }
    await persistCascade(next);
  };

  return (
    <section className="space-y-4">
      <header className="flex items-end justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Cronograma diário</h2>
          <p className="text-sm text-muted-foreground">
            Modelo de {DAY_START} às 18:00. Defina o horário inicial — os demais são calculados pela duração.
          </p>
        </div>
      </header>

      <ul className="space-y-1 rounded-lg border bg-card divide-y">
        {items.map((it, idx) => (
          <ScheduleRow
            key={it.id}
            start={computedStarts[idx]}
            title={it.title}
            duration={it.duration_minutes}
            status={it.status}
            tasks={importableTasks}
            linkedTaskId={it.task_id}
            isFirst={idx === 0}
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
            tasks={importableTasks}
            editableStart={i === 0 && items.length === 0}
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
  isFirst: boolean;
}

const ScheduleRow = ({
  start,
  title,
  duration,
  status,
  tasks,
  linkedTaskId,
  isFirst,
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

  return (
    <li className="flex flex-wrap items-center gap-2 px-3 py-2 group">
      {isFirst ? (
        <Input
          type="time"
          value={start}
          onChange={(e) => onChangeStart(e.target.value)}
          className="h-8 text-xs w-[100px]"
        />
      ) : (
        <div className="h-8 w-[100px] text-xs flex items-center px-2 text-muted-foreground tabular-nums">
          {start}
        </div>
      )}
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
        {linkedTaskId ? (
          <div
            title="Vinculado a uma tarefa — edite o título na seção Tarefas"
            className={`h-8 text-sm flex-1 flex items-center px-3 rounded-md border border-dashed border-border bg-muted/30 text-foreground/90 truncate cursor-not-allowed ${status === "feita" ? "line-through text-muted-foreground" : ""}`}
          >
            {title || <span className="text-muted-foreground italic">Tarefa vinculada</span>}
          </div>
        ) : (
          <Input
            value={localTitle}
            onChange={(e) => setLocalTitle(e.target.value)}
            onBlur={() => localTitle !== title && onChangeTitle(localTitle)}
            placeholder="Tarefa..."
            className={`h-8 text-sm flex-1 ${status === "feita" ? "line-through text-muted-foreground" : ""}`}
          />
        )}
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
  editableStart = false,
  onCommit,
}: {
  initialStart: string;
  initialDuration: number;
  tasks: Task[];
  editableStart?: boolean;
  onCommit: (start: string, title: string, duration: number, taskId: string | null) => void;
}) => {
  const [start, setStart] = useState(initialStart);
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState(initialDuration);
  useEffect(() => setStart(initialStart), [initialStart]);

  const commit = (t: string, taskId: string | null = null) => {
    if (t.trim()) onCommit(start, t, duration, taskId);
  };

  return (
    <li className="flex flex-wrap items-center gap-2 px-3 py-2 opacity-70 hover:opacity-100 transition">
      {editableStart ? (
        <Input
          type="time"
          value={start}
          onChange={(e) => setStart(e.target.value)}
          className="h-8 text-xs w-[100px]"
        />
      ) : (
        <div className="h-8 w-[100px] text-xs flex items-center px-2 text-muted-foreground tabular-nums">
          {start}
        </div>
      )}
      <ImportButton
        tasks={tasks}
        onPick={(task) => {
          commit(task.title, task.id);
          setTitle("");
          setDuration(initialDuration);
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
      <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground w-[110px] text-center">
        Pendente
      </span>
      <span className="w-4" />
    </li>
  );
};

const ImportButton = ({ tasks, onPick }: { tasks: Task[]; onPick: (task: Task) => void }) => (
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
      {tasks.map((t) => {
        const d = (t as Task & { task_date?: string }).task_date;
        const dateLabel = d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "";
        return (
          <DropdownMenuItem key={t.id} onSelect={() => onPick(t)} className="text-sm flex justify-between gap-2">
            <span className="truncate">{t.title}</span>
            {dateLabel && <span className="text-xs text-muted-foreground shrink-0">{dateLabel}</span>}
          </DropdownMenuItem>
        );
      })}
    </DropdownMenuContent>
  </DropdownMenu>
);
