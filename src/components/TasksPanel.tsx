import { Fragment, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NoteField } from "@/components/shared/NoteField";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Trash2,
  Plus,
  ChevronRight,
  ChevronDown,
  StickyNote,
  List,
  TableIcon,
  Columns3,
  LayoutGrid,
  Pencil,
  Check,
  X,
  Search,
  MoreHorizontal,
  Calendar as CalendarIcon,
  Circle,
  Flag,
  Eye,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import {
  TASK_STATUS,
  PRIORITIES,
  statusPill,
  priorityPill,
  type TaskStatus,
  type Priority,
} from "@/lib/taskTokens";

import { StatusPill as SharedStatusPill } from "@/components/shared/StatusPill";
import { PriorityPill as SharedPriorityPill } from "@/components/shared/PriorityPill";
import { EmptyState } from "@/components/shared/EmptyState";
import { ListChecks, Repeat, ArrowUp, ArrowDown, History } from "lucide-react";
import { logActivity } from "@/lib/activityLog";
import { nextOccurrenceDate, RECURRENCE_OPTIONS, type RecurrenceType } from "@/lib/recurrence";
import { ActivityLogList } from "@/components/shared/ActivityLogList";
import { useConfirm } from "@/components/shared/ConfirmDialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useWorkspace } from "@/hooks/useWorkspace";
import { TaskReminderEditor } from "@/components/notifications/TaskReminderEditor";
import { NewTaskDialog } from "@/components/tasks/NewTaskDialog";
import { BellRing, Settings2 } from "lucide-react";


export interface Task {
  id: string;
  title: string;
  done: boolean;
  task_date: string;
  status: TaskStatus;
  priority: Priority;
  due_date: string | null;
  notes: string;
  position: number;
  is_recurring?: boolean;
  recurrence_type?: RecurrenceType | null;
  recurrence_interval?: number;
  recurrence_end_date?: string | null;
  parent_recurring_task_id?: string | null;
  source_type?: "manual" | "request" | "process";
  source_id?: string | null;
  due_time?: string | null;

}

interface Subtask {
  id: string;
  task_id: string;
  title: string;
  done: boolean;
  status: TaskStatus;
  notes: string;
  position: number;
}

export type TasksFilter = "all" | "today" | "done" | "kanban";
type ViewMode = "list" | "table" | "cards" | "kanban";
type TaskIndicator = "priority" | "status" | "due" | "progress";

const INDICATOR_LABELS: Record<TaskIndicator, string> = {
  priority: "Prioridade",
  status: "Status",
  due: "Prazo",
  progress: "Progresso",
};

const DEFAULT_INDICATORS: Record<ViewMode, TaskIndicator[]> = {
  list: [],
  table: ["priority", "status", "due", "progress"],
  cards: ["priority", "status", "due", "progress"],
  kanban: ["priority", "due", "progress"],
};

const AVAILABLE_INDICATORS: Record<ViewMode, TaskIndicator[]> = {
  list: [],
  table: ["priority", "status", "due", "progress"],
  cards: ["priority", "status", "due", "progress"],
  kanban: ["priority", "due", "progress"], // status is implicit by column
};

interface Props {
  date: string;
  userId: string;
  filter?: TasksFilter;
  onTasksChange?: (tasks: Task[]) => void;
}

const lsGet = <T,>(k: string, f: T): T => {
  try {
    return JSON.parse(localStorage.getItem(k) || "null") ?? f;
  } catch {
    return f;
  }
};

export const TasksPanel = ({
  date,
  userId,
  filter = "all",
  onTasksChange,
}: Props) => {
  const { workspaceId } = useWorkspace();
  const confirm = useConfirm();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [subtasks, setSubtasks] = useState<Record<string, Subtask[]>>({});
  const [title, setTitle] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [notesOpen, setNotesOpen] = useState<Record<string, boolean>>({});
  const [subInput, setSubInput] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [editingSubId, setEditingSubId] = useState<string | null>(null);
  const [editingSubValue, setEditingSubValue] = useState("");
  const [search, setSearch] = useState("");
  const [visibleStatuses, setVisibleStatuses] = useState<TaskStatus[]>(
    () => lsGet<TaskStatus[]>("tasksVisibleStatuses", []),
  );
  const [priorityFilter, setPriorityFilter] = useState<Priority | "todos">("todos");
  const [dateFilter, setDateFilter] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>(
    () => (lsGet<ViewMode>("tasksView", "list")),
  );
  const [indicators, setIndicators] = useState<Record<ViewMode, TaskIndicator[]>>(
    () => ({
      list: lsGet<TaskIndicator[]>("tasksIndicators:list", DEFAULT_INDICATORS.list),
      table: lsGet<TaskIndicator[]>("tasksIndicators:table", DEFAULT_INDICATORS.table),
      cards: lsGet<TaskIndicator[]>("tasksIndicators:cards", DEFAULT_INDICATORS.cards),
      kanban: lsGet<TaskIndicator[]>("tasksIndicators:kanban", DEFAULT_INDICATORS.kanban),
    }),
  );
  const [newDialogOpen, setNewDialogOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem("tasksVisibleStatuses", JSON.stringify(visibleStatuses));
  }, [visibleStatuses]);

  useEffect(() => {
    localStorage.setItem("tasksView", JSON.stringify(view));
  }, [view]);

  useEffect(() => {
    (Object.keys(indicators) as ViewMode[]).forEach((k) => {
      localStorage.setItem(`tasksIndicators:${k}`, JSON.stringify(indicators[k]));
    });
  }, [indicators]);

  const show = useMemo(() => {
    const cur = indicators[view] ?? [];
    return {
      priority: cur.includes("priority"),
      status: cur.includes("status"),
      due: cur.includes("due"),
      progress: cur.includes("progress"),
    };
  }, [indicators, view]);

  const toggleIndicator = (key: TaskIndicator) => {
    setIndicators((p) => {
      const cur = p[view] ?? [];
      const next = cur.includes(key) ? cur.filter((x) => x !== key) : [...cur, key];
      return { ...p, [view]: next };
    });
  };

  const resetIndicators = () => {
    setIndicators((p) => ({ ...p, [view]: DEFAULT_INDICATORS[view] }));
  };

  const today = new Date().toISOString().slice(0, 10);

  const load = async () => {
    if (!workspaceId) { setTasks([]); setSubtasks({}); return; }
    let query = supabase.from("tasks").select("*").eq("workspace_id", workspaceId);
    // "all" = show every task across dates; calendar is just an optional filter
    if (filter === "today") query = query.eq("task_date", today);
    query = query
      .order("task_date", { ascending: true })
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });
    const { data, error } = await query;
    if (error) return toast.error(error.message);
    let list = (data ?? []) as Task[];
    if (filter === "done") list = list.filter((t) => t.done);
    setTasks(list);
    onTasksChange?.(list);
    if (list.length) {
      const { data: subs } = await supabase
        .from("subtasks")
        .select("*")
        .in("task_id", list.map((t) => t.id))
        .order("position", { ascending: true })
        .order("created_at", { ascending: true });
      const grouped: Record<string, Subtask[]> = {};
      (subs ?? []).forEach((s) => {
        (grouped[s.task_id] ||= []).push(s as unknown as Subtask);
      });
      setSubtasks(grouped);
    } else setSubtasks({});
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, filter, workspaceId]);

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      const s = (t.status ?? "pendente") as TaskStatus;
      if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
      if (visibleStatuses.length > 0 && !visibleStatuses.includes(s)) return false;
      if (priorityFilter !== "todos" && (t.priority ?? "media") !== priorityFilter) return false;
      if (dateFilter && t.task_date !== dateFilter) return false;
      return true;
    });
  }, [tasks, search, visibleStatuses, priorityFilter, dateFilter]);

  // Group tasks by task_date for the list view
  const groupedByDate = useMemo(() => {
    const groups = new Map<string, Task[]>();
    for (const t of filtered) {
      const key = t.task_date || "__nodate__";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(t);
    }
    const entries = Array.from(groups.entries());
    entries.sort(([a], [b]) => {
      if (a === "__nodate__") return 1;
      if (b === "__nodate__") return -1;
      return a < b ? -1 : a > b ? 1 : 0;
    });
    return entries;
  }, [filtered]);

  const formatGroupDate = (iso: string) => {
    if (iso === "__nodate__") return "Sem data";
    const d = new Date(iso + "T00:00:00");
    const txt = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
    if (iso === today) return `Hoje Â· ${txt}`;
    return txt;
  };

  const monthLabel = useMemo(() => {
    const firstDated = groupedByDate.find(([k]) => k !== "__nodate__")?.[0];
    const base = dateFilter ?? firstDated ?? today;
    const d = new Date(base + "T00:00:00");
    const txt = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    return txt.charAt(0).toUpperCase() + txt.slice(1);
  }, [groupedByDate, dateFilter, today]);

  const add = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const t = title.trim();
    if (!t) return;
    if (t.length > 200) return toast.error("Título muito longo");
    const targetDate = dateFilter ?? (filter === "today" ? today : today);
    const { data, error } = await supabase.from("tasks").insert({
      title: t,
      task_date: targetDate,
      user_id: userId,
      position: tasks.length,
      workspace_id: workspaceId ?? undefined,
    } as never).select().single();
    if (error) return toast.error(error.message);
    setTitle("");
    if (data) await logActivity(userId, "task", data.id, "created", `Tarefa criada: "${t}"`);
    toast.success("Tarefa criada");
    load();
  };

  const generateNextOccurrence = async (t: Task) => {
    if (!t.is_recurring || !t.recurrence_type) return;
    const base = t.due_date ?? t.task_date;
    const nextISO = nextOccurrenceDate(
      base,
      t.recurrence_type,
      t.recurrence_interval ?? 1,
      t.recurrence_end_date,
    );
    if (!nextISO) return;
    const parentId = t.parent_recurring_task_id ?? t.id;
    const { data, error } = await supabase.from("tasks").insert({
      title: t.title,
      notes: t.notes,
      priority: t.priority,
      task_date: nextISO,
      due_date: t.due_date ? nextISO : null,
      user_id: userId,
      position: tasks.length,
      is_recurring: true,
      recurrence_type: t.recurrence_type,
      recurrence_interval: t.recurrence_interval ?? 1,
      recurrence_end_date: t.recurrence_end_date ?? null,
      parent_recurring_task_id: parentId,
      workspace_id: workspaceId ?? undefined,
    } as never).select().single();
    if (error) return toast.error("Erro ao gerar recorrência: " + error.message);
    if (data) await logActivity(userId, "task", data.id, "recurrence_generated", `Próxima ocorrência criada para ${nextISO}`);
    toast.success(`Próxima ocorrência criada (${nextISO})`);
  };

  const updateTask = async (id: string, patch: Partial<Task>) => {
    const { error } = await supabase.from("tasks").update(patch as never).eq("id", id);
    if (error) return toast.error(error.message);
    // 2-way sync: if status/done changed, mirror to linked schedule_items
    if (patch.status !== undefined || patch.done !== undefined) {
      const newStatus = patch.status ?? (patch.done ? "feita" : undefined);
      if (newStatus) {
        await supabase
          .from("schedule_items")
          .update({ status: newStatus })
          .eq("task_id", id)
          .neq("status", "pulado");
      }
    }
    load();
  };

  const setStatus = async (t: Task, status: TaskStatus) => {
    const wasFeita = t.status === "feita";
    await updateTask(t.id, { status, done: status === "feita" });
    await logActivity(
      userId,
      "task",
      t.id,
      status === "feita" ? "completed" : "status_changed",
      `Status: ${t.status ?? "pendente"} â†’ ${status}`,
    );
    if (status === "feita" && !wasFeita && t.is_recurring) {
      await generateNextOccurrence(t);
      load();
    }
  };

  const remove = async (id: string) => {
    if (!(await confirm({ title: "Excluir tarefa", description: "Esta ação não pode ser desfeita.", destructive: true, confirmText: "Excluir" }))) return;
    const t = tasks.find((x) => x.id === id);
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) return toast.error(error.message);
    await logActivity(userId, "task", id, "deleted", `Tarefa excluída: "${t?.title ?? ""}"`);
    toast.success("Tarefa excluída");
    load();
  };

  const startEdit = (t: Task) => {
    setEditingId(t.id);
    setEditingValue(t.title);
  };
  const saveEdit = async () => {
    if (!editingId) return;
    const v = editingValue.trim();
    if (!v) return toast.error("Título vazio");
    await updateTask(editingId, { title: v });
    setEditingId(null);
  };

  const startEditSub = (s: Subtask) => {
    setEditingSubId(s.id);
    setEditingSubValue(s.title);
  };
  const saveEditSub = async () => {
    if (!editingSubId) return;
    const v = editingSubValue.trim();
    if (!v) return toast.error("Título vazio");
    const { error } = await supabase.from("subtasks").update({ title: v }).eq("id", editingSubId);
    if (error) return toast.error(error.message);
    setEditingSubId(null);
    load();
  };

  const maybeAutoComplete = async (taskId: string) => {
    const { data: subs } = await supabase
      .from("subtasks")
      .select("done")
      .eq("task_id", taskId);
    if (!subs || subs.length === 0) return;
    const allDone = subs.every((s) => s.done);
    await supabase
      .from("tasks")
      .update({ done: allDone, status: allDone ? "feita" : "fazendo" })
      .eq("id", taskId);
  };

  const addSub = async (taskId: string) => {
    const t = (subInput[taskId] ?? "").trim();
    if (!t) return;
    const subs = subtasks[taskId] ?? [];
    const { error } = await supabase
      .from("subtasks")
      .insert({ task_id: taskId, user_id: userId, title: t, position: subs.length, workspace_id: workspaceId ?? undefined } as never);
    if (error) return toast.error(error.message);
    setSubInput((p) => ({ ...p, [taskId]: "" }));
    await maybeAutoComplete(taskId);
    load();
  };

  const toggleSub = async (s: Subtask) => {
    await supabase
      .from("subtasks")
      .update({ done: !s.done, status: !s.done ? "feita" : "pendente" })
      .eq("id", s.id);
    await maybeAutoComplete(s.task_id);
    load();
  };

  const removeSub = async (s: Subtask) => {
    if (!(await confirm({ title: "Excluir subtarefa", description: `"${s.title}" será excluída.`, destructive: true, confirmText: "Excluir" }))) return;
    await supabase.from("subtasks").delete().eq("id", s.id);
    await maybeAutoComplete(s.task_id);
    load();
  };

  const moveSub = async (s: Subtask, direction: -1 | 1) => {
    const list = (subtasks[s.task_id] ?? []).slice().sort((a, b) => a.position - b.position);
    const idx = list.findIndex((x) => x.id === s.id);
    const swapIdx = idx + direction;
    if (idx < 0 || swapIdx < 0 || swapIdx >= list.length) return;
    const a = list[idx], b = list[swapIdx];
    await Promise.all([
      supabase.from("subtasks").update({ position: b.position }).eq("id", a.id),
      supabase.from("subtasks").update({ position: a.position }).eq("id", b.id),
    ]);
    load();
  };

  const saveNote = async (id: string, value: string, kind: "task" | "sub") => {
    const { error } = await supabase
      .from(kind === "task" ? "tasks" : "subtasks")
      .update({ notes: value })
      .eq("id", id);
    if (error) throw error;
    if (kind === "task") {
      setTasks((p) => p.map((t) => (t.id === id ? { ...t, notes: value } : t)));
    } else {
      setSubtasks((p) => {
        const next: typeof p = {};
        for (const k in p) next[k] = p[k].map((s) => (s.id === id ? { ...s, notes: value } : s));
        return next;
      });
    }
  };

  const toggleExpand = (id: string) => setExpanded((p) => ({ ...p, [id]: !p[id] }));
  const toggleNotes = (id: string) => setNotesOpen((p) => ({ ...p, [id]: !p[id] }));

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ shared bits â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const StatusPill = ({
    value,
    onChange,
    size = "sm",
  }: {
    value: TaskStatus;
    onChange: (v: TaskStatus) => void;
    size?: "sm" | "xs";
  }) => (
    <SharedStatusPill domain="task" value={value} onChange={(v) => onChange(v as TaskStatus)} size={size} />
  );

  const PriorityPill = ({
    value,
    onChange,
  }: {
    value: Priority;
    onChange: (v: Priority) => void;
  }) => (
    <SharedPriorityPill value={value} onChange={onChange} />
  );

  const ProgressBadge = ({ t }: { t: Task }) => {
    const subs = subtasks[t.id] ?? [];
    if (!subs.length) return null;
    const done = subs.filter((s) => s.done).length;
    const pct = Math.round((done / subs.length) * 100);
    return (
      <div className="flex items-center gap-1.5">
        <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-foreground/70 transition-all" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {done}/{subs.length}
        </span>
      </div>
    );
  };

  const TaskTitle = ({ t }: { t: Task }) =>
    editingId === t.id ? (
      <div className="flex items-center gap-1 flex-1">
        <Input
          value={editingValue}
          onChange={(e) => setEditingValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") saveEdit();
            if (e.key === "Escape") setEditingId(null);
          }}
          autoFocus
          maxLength={200}
          className="h-8"
        />
        <button onClick={saveEdit} className="p-1 text-emerald-600" aria-label="Salvar">
          <Check className="h-4 w-4" />
        </button>
        <button onClick={() => setEditingId(null)} className="p-1 text-muted-foreground" aria-label="Cancelar">
          <X className="h-4 w-4" />
        </button>
      </div>
    ) : (
      <button
        onDoubleClick={() => startEdit(t)}
        title={t.title}
        className={cn(
          "flex-1 min-w-0 text-left text-sm leading-snug truncate",
          t.done && "line-through text-muted-foreground",
        )}
      >
        {t.title}
      </button>
    );

  const SubsBlock = ({ t }: { t: Task }) => {
    const subs = subtasks[t.id] ?? [];
    return (
      <div className="space-y-2 pl-7">
        <ul className="space-y-1">
          {subs.map((s) => {
            const isEditing = editingSubId === s.id;
            const noteOpen = notesOpen[`sub:${s.id}`];
            return (
              <li key={s.id} className="space-y-1">
                <div className="flex items-center gap-2 group/sub py-0.5">
                  <Checkbox
                    checked={s.done}
                    onCheckedChange={() => toggleSub(s)}
                    className="h-3.5 w-3.5"
                  />
                  {isEditing ? (
                    <>
                      <Input
                        value={editingSubValue}
                        onChange={(e) => setEditingSubValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEditSub();
                          if (e.key === "Escape") setEditingSubId(null);
                        }}
                        autoFocus
                        maxLength={200}
                        className="h-7 text-sm flex-1"
                      />
                      <button onClick={saveEditSub} className="p-1 text-emerald-600">
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => setEditingSubId(null)} className="p-1 text-muted-foreground">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onDoubleClick={() => startEditSub(s)}
                        className={cn(
                          "flex-1 text-left text-[13px]",
                          s.done && "line-through text-muted-foreground",
                        )}
                      >
                        {s.title}
                      </button>
                      <button
                        onClick={() => toggleNotes(`sub:${s.id}`)}
                        className={cn(
                          "transition p-1",
                          s.notes
                            ? "text-foreground"
                            : "text-muted-foreground opacity-0 group-hover/sub:opacity-100",
                        )}
                        title="Observação"
                      >
                        <StickyNote className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => startEditSub(s)}
                        className="p-1 text-muted-foreground hover:text-foreground opacity-0 group-hover/sub:opacity-100"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => moveSub(s, -1)}
                        className="p-1 text-muted-foreground hover:text-foreground opacity-0 group-hover/sub:opacity-100"
                        title="Mover acima"
                      >
                        <ArrowUp className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => moveSub(s, 1)}
                        className="p-1 text-muted-foreground hover:text-foreground opacity-0 group-hover/sub:opacity-100"
                        title="Mover abaixo"
                      >
                        <ArrowDown className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => removeSub(s)}
                        className="p-1 text-muted-foreground hover:text-destructive opacity-0 group-hover/sub:opacity-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </div>
                {noteOpen && (
                  <div className="ml-6 max-w-full min-w-0 pr-2">
                    <NoteField
                      value={s.notes}
                      onSave={(v) => saveNote(s.id, v, "sub")}
                      placeholder="Observação..."
                      className="min-h-8 py-1.5 text-xs leading-5"
                      rows={1}
                      autoResize
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            addSub(t.id);
          }}
          className="flex items-center gap-2 pl-1"
        >
          <Plus className="h-3 w-3 text-muted-foreground" />
          <Input
            value={subInput[t.id] ?? ""}
            onChange={(e) => setSubInput((p) => ({ ...p, [t.id]: e.target.value }))}
            placeholder="Adicionar sub-tarefa"
            maxLength={200}
            className="h-7 text-[13px] border-0 shadow-none focus-visible:ring-0 px-1 bg-transparent"
          />
        </form>
      </div>
    );
  };

  const [historyId, setHistoryId] = useState<string | null>(null);
  const [recurEditingId, setRecurEditingId] = useState<string | null>(null);
  const [reminderTaskId, setReminderTaskId] = useState<string | null>(null);


  const RowActions = ({ t }: { t: Task }) => (
    <div className="flex items-center gap-0.5">
      {t.is_recurring && (
        <span title="Recorrente" className="text-muted-foreground">
          <Repeat className="h-3.5 w-3.5" />
        </span>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger className="p-1 text-muted-foreground hover:text-foreground rounded">
          <MoreHorizontal className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => startEdit(t)}>
            <Pencil className="h-3.5 w-3.5 mr-2" /> Editar título
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => toggleNotes(`task:${t.id}`)}>
            <StickyNote className="h-3.5 w-3.5 mr-2" /> Observação
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => toggleExpand(t.id)}>
            <ChevronDown className="h-3.5 w-3.5 mr-2" /> Sub-tarefas
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setRecurEditingId(t.id)}>
            <Repeat className="h-3.5 w-3.5 mr-2" /> Recorrência
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setReminderTaskId(t.id)}>
            <BellRing className="h-3.5 w-3.5 mr-2" /> Alertas
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setHistoryId(t.id)}>
            <History className="h-3.5 w-3.5 mr-2" /> Histórico
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => remove(t.id)} className="text-destructive">
            <Trash2 className="h-3.5 w-3.5 mr-2" /> Remover
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  const DueDate = ({ t }: { t: Task }) => (
    <div className="relative shrink-0">
      <Input
        type="date"
        value={t.due_date ?? ""}
        onChange={(e) => updateTask(t.id, { due_date: e.target.value || null })}
        className="h-7 w-[150px] text-xs border-dashed bg-transparent pl-2 pr-1.5 [&::-webkit-calendar-picker-indicator]:ml-1 [&::-webkit-calendar-picker-indicator]:p-0 [&::-webkit-calendar-picker-indicator]:opacity-70 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
      />
    </div>
  );

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ views â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const renderListRow = (t: Task) => {
    const noteKey = `task:${t.id}`;
    const subs = subtasks[t.id] ?? [];
    return (
      <div key={t.id} className="group rounded-md hover:bg-secondary/60 transition-colors">
        <div className="flex items-center gap-2 px-2 py-1.5">
          <button
            onClick={() => toggleExpand(t.id)}
            className={cn(
              "p-0.5 text-muted-foreground hover:text-foreground transition",
              !subs.length && "invisible",
            )}
          >
            {expanded[t.id] ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
          <Checkbox
            checked={t.done}
            onCheckedChange={(v) => setStatus(t, v ? "feita" : "pendente")}
          />
          <TaskTitle t={t} />
          <div className="shrink-0"><ProgressBadge t={t} /></div>
          <div className="shrink-0"><PriorityPill value={t.priority ?? "media"} onChange={(v) => updateTask(t.id, { priority: v })} /></div>
          <div className="shrink-0"><StatusPill value={t.status ?? "pendente"} onChange={(v) => setStatus(t, v)} /></div>
          <DueDate t={t} />
          <div className="shrink-0"><RowActions t={t} /></div>
        </div>
        {notesOpen[noteKey] && (
          <div className="px-10 pb-2">
            <NoteField
              value={t.notes}
              onSave={(v) => saveNote(t.id, v, "task")}
              placeholder="Observação da tarefa..."
              className="text-sm min-h-[60px]"
            />
          </div>
        )}
        {expanded[t.id] && <div className="pb-3">{SubsBlock({ t })}</div>}
      </div>
    );
  };

  return (
    <TooltipProvider delayDuration={200}>
      <section className="space-y-4">
        {/* New task â€” destaque */}
        <form onSubmit={add} className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 shadow-sm">
          <Plus className="h-4 w-4 text-muted-foreground" />
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Nova tarefa  (Enter para adicionar)"
            maxLength={200}
            className="border-0 shadow-none focus-visible:ring-0 px-0 h-8 text-sm"
          />
          {title && (
            <Button type="submit" size="sm" variant="ghost" className="h-7">
              Adicionar
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 gap-1.5"
            onClick={() => setNewDialogOpen(true)}
          >
            <Settings2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Configurar</span>
          </Button>
        </form>

        {workspaceId && (
          <NewTaskDialog
            open={newDialogOpen}
            onOpenChange={setNewDialogOpen}
            userId={userId}
            workspaceId={workspaceId}
            defaultDate={dateFilter ?? today}
            initialTitle={title}
            positionHint={tasks.length}
            onCreated={() => { setTitle(""); load(); }}
          />
        )}

        {/* Filtros compactos */}
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="relative w-full sm:w-[220px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar..."
              className="h-9 pl-8"
            />
          </div>

          {/* Data */}
          <Popover>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn("h-9 w-9 p-0 relative", dateFilter && "border-foreground/40 bg-secondary/60")}
                    aria-label="Filtrar por data"
                  >
                    <CalendarIcon className="h-4 w-4" />
                    {dateFilter && <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-foreground" />}
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent>Filtrar por data</TooltipContent>
            </Tooltip>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateFilter ? new Date(dateFilter + "T00:00:00") : undefined}
                onSelect={(d) => setDateFilter(d ? d.toISOString().slice(0, 10) : null)}
                className={cn("p-3 pointer-events-auto")}
              />
              {dateFilter && (
                <div className="p-2 border-t">
                  <Button variant="ghost" size="sm" className="w-full h-8 text-xs" onClick={() => setDateFilter(null)}>
                    <X className="h-3 w-3" /> Limpar data
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>

          {/* Status */}
          <Popover>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn("h-9 w-9 p-0 relative", visibleStatuses.length > 0 && "border-foreground/40 bg-secondary/60")}
                    aria-label="Filtrar por status"
                  >
                    <Circle className="h-4 w-4" />
                    {visibleStatuses.length > 0 && (
                      <span className="absolute -top-1 -right-1 rounded-full bg-foreground text-background text-[10px] h-4 min-w-4 px-1 inline-flex items-center justify-center tabular-nums">
                        {visibleStatuses.length}
                      </span>
                    )}
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent>Filtrar por status</TooltipContent>
            </Tooltip>
            <PopoverContent align="start" className="w-56 space-y-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Mostrar status
              </p>
              <div className="space-y-1">
                {TASK_STATUS.map((o) => {
                  const checked = visibleStatuses.includes(o.value);
                  return (
                    <label key={o.value} className="flex items-center gap-2 text-xs cursor-pointer py-1">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() =>
                          setVisibleStatuses((cur) =>
                            cur.includes(o.value)
                              ? cur.filter((x) => x !== o.value)
                              : [...cur, o.value],
                          )
                        }
                        className="h-3.5 w-3.5"
                      />
                      <span className={cn("px-1.5 py-0.5 rounded-full text-[11px]", statusPill[o.value])}>
                        {o.label}
                      </span>
                    </label>
                  );
                })}
              </div>
              {visibleStatuses.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full h-8 text-xs"
                  onClick={() => setVisibleStatuses([])}
                >
                  <X className="h-3 w-3" /> Mostrar todos
                </Button>
              )}
            </PopoverContent>
          </Popover>

          {/* Prioridade */}
          <Popover>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn("h-9 w-9 p-0 relative", priorityFilter !== "todos" && "border-foreground/40 bg-secondary/60")}
                    aria-label="Filtrar por prioridade"
                  >
                    <Flag className="h-4 w-4" />
                    {priorityFilter !== "todos" && (
                      <span className={cn("absolute top-1 right-1 h-2 w-2 rounded-full", priorityPill[priorityFilter as Priority])} />
                    )}
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent>Filtrar por prioridade</TooltipContent>
            </Tooltip>
            <PopoverContent align="start" className="w-56 space-y-1">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground px-1">
                Filtrar por prioridade
              </p>
              <button
                onClick={() => setPriorityFilter("todos")}
                className={cn(
                  "w-full text-left text-xs px-2 py-1.5 rounded-md hover:bg-secondary transition",
                  priorityFilter === "todos" && "bg-secondary font-medium",
                )}
              >
                Todas as prioridades
              </button>
              {PRIORITIES.map((o) => (
                <button
                  key={o.value}
                  onClick={() => setPriorityFilter(o.value)}
                  className={cn(
                    "w-full text-left text-xs px-2 py-1.5 rounded-md hover:bg-secondary transition flex items-center gap-2",
                    priorityFilter === o.value && "bg-secondary font-medium",
                  )}
                >
                  <span className={cn("px-1.5 py-0.5 rounded-full text-[11px]", priorityPill[o.value])}>
                    {o.label}
                  </span>
                </button>
              ))}
            </PopoverContent>
          </Popover>

          {/* View switcher */}
          <div className="flex rounded-md border overflow-hidden bg-card ml-auto">
            {([
              ["list", List, "Lista"],
              ["table", TableIcon, "Tabela"],
              ["cards", LayoutGrid, "Cards"],
              ["kanban", Columns3, "Kanban"],
            ] as const).map(([m, Icon, label]) => (
              <Tooltip key={m}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setView(m)}
                    className={cn(
                      "px-2.5 py-2 text-xs transition",
                      view === m
                        ? "bg-secondary text-foreground"
                        : "text-muted-foreground hover:bg-secondary/60",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>{label}</TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>

        {dateFilter && (
          <div className="flex items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-full border bg-secondary/60 px-2.5 py-1">
              <CalendarIcon className="h-3 w-3" />
              Filtrando: {new Date(dateFilter + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
            </span>
            <button
              onClick={() => setDateFilter(null)}
              className="text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
            >
              Limpar filtro
            </button>
          </div>
        )}
        {filtered.length === 0 && (
          tasks.length === 0 ? (
            <EmptyState
              icon={ListChecks}
              title="Nenhuma tarefa ainda"
              description="Use o campo acima para adicionar uma nova tarefa."
            />
          ) : (
            <div className="rounded-lg border border-dashed bg-card/50 py-10 text-center">
              <p className="text-sm text-muted-foreground">Nada combina com o filtro.</p>
            </div>
          )
        )}


        {/* List view â€” grouped by date */}
        {view === "list" && filtered.length > 0 && (
          <div className="space-y-5">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-medium text-muted-foreground tabular-nums">
                {monthLabel}
              </span>
            </div>
            {groupedByDate.map(([key, items]) => (
              <div key={key} className="space-y-2">
                <div className="flex items-baseline gap-2 px-1">
                  <button
                    type="button"
                    onClick={() => key !== "__nodate__" && setDateFilter(dateFilter === key ? null : key)}
                    disabled={key === "__nodate__"}
                    className={cn(
                      "text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground transition text-left",
                      dateFilter === key && "text-foreground",
                      key === "__nodate__" && "cursor-default hover:text-muted-foreground",
                    )}
                  >
                    {formatGroupDate(key)}
                  </button>
                  <span className="text-[11px] text-muted-foreground tabular-nums">
                    {items.length}
                  </span>
                </div>
                <div className="rounded-lg border bg-card divide-y">
                  {items.map(renderListRow)}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Table view */}
        {view === "table" && filtered.length > 0 && (
          <div className="rounded-lg border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Tarefa</TableHead>
                  <TableHead className="w-32">Progresso</TableHead>
                  <TableHead className="w-28">Prioridade</TableHead>
                  <TableHead className="w-32">Status</TableHead>
                  <TableHead className="w-36">Prazo</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((t) => {
                  const noteKey = `task:${t.id}`;
                  return (
                    <Fragment key={t.id}>
                      <TableRow>
                        <TableCell>
                          <Checkbox
                            checked={t.done}
                            onCheckedChange={(v) => setStatus(t, v ? "feita" : "pendente")}
                          />
                        </TableCell>
                        <TableCell>
                          <TaskTitle t={t} />
                        </TableCell>
                        <TableCell>
                          <ProgressBadge t={t} />
                        </TableCell>
                        <TableCell>
                          <PriorityPill value={t.priority ?? "media"} onChange={(v) => updateTask(t.id, { priority: v })} />
                        </TableCell>
                        <TableCell>
                          <StatusPill value={t.status ?? "pendente"} onChange={(v) => setStatus(t, v)} />
                        </TableCell>
                        <TableCell>
                          <DueDate t={t} />
                        </TableCell>
                        <TableCell>
                          <RowActions t={t} />
                        </TableCell>
                      </TableRow>
                      {(notesOpen[noteKey] || expanded[t.id]) && (
                        <TableRow>
                          <TableCell colSpan={7} className="bg-muted/30">
                            {notesOpen[noteKey] && (
                              <div className="mb-2">
                                <NoteField
                                  value={t.notes}
                                  onSave={(v) => saveNote(t.id, v, "task")}
                                  placeholder="Observação..."
                                  className="text-sm"
                                />
                              </div>
                            )}
                            {expanded[t.id] && SubsBlock({ t })}
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Cards view */}
        {view === "cards" && filtered.length > 0 && (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {filtered.map((t) => {
              const noteKey = `task:${t.id}`;
              return (
                <div key={t.id} className="spotlight rounded-lg border bg-card p-4 space-y-3 transition">
                  <div className="flex items-start gap-2">
                    <Checkbox
                      checked={t.done}
                      onCheckedChange={(v) => setStatus(t, v ? "feita" : "pendente")}
                      className="mt-1"
                    />
                    <TaskTitle t={t} />
                    <RowActions t={t} />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <PriorityPill value={t.priority ?? "media"} onChange={(v) => updateTask(t.id, { priority: v })} />
                    <StatusPill value={t.status ?? "pendente"} onChange={(v) => setStatus(t, v)} />
                  </div>
                  <div className="flex items-center justify-between">
                    <ProgressBadge t={t} />
                    <DueDate t={t} />
                  </div>
                  {notesOpen[noteKey] && (
                    <NoteField
                      value={t.notes}
                      onSave={(v) => saveNote(t.id, v, "task")}
                      placeholder="Observação..."
                      className="text-sm"
                    />
                  )}
                  {expanded[t.id] && SubsBlock({ t })}
                </div>
              );
            })}
          </div>
        )}

        {/* Kanban view */}
        {view === "kanban" && filtered.length > 0 && (
          <div className="overflow-x-auto -mx-2 pb-2">
            <div className="flex gap-3 px-2 min-w-max">
              {TASK_STATUS.map((col) => {
                const colTasks = filtered.filter((t) => (t.status ?? "pendente") === col.value);
                return (
                  <div key={col.value} className="w-72 shrink-0 rounded-lg border bg-card/60 flex flex-col min-h-[200px]">
                    <div className="px-3 py-2 border-b flex items-center justify-between">
                      <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", statusPill[col.value])}>
                        {col.label}
                      </span>
                      <span className="text-[11px] text-muted-foreground tabular-nums">{colTasks.length}</span>
                    </div>
                    <div className="p-2 space-y-2 flex-1">
                      {colTasks.map((t) => (
                        <div key={t.id} className="spotlight-sm rounded-md border bg-card p-2.5 space-y-2 group">
                          <div className="flex items-start gap-2">
                            <Checkbox
                              checked={t.done}
                              onCheckedChange={(v) => setStatus(t, v ? "feita" : "pendente")}
                              className="mt-0.5"
                            />
                            <TaskTitle t={t} />
                            <RowActions t={t} />
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <PriorityPill value={t.priority ?? "media"} onChange={(v) => updateTask(t.id, { priority: v })} />
                            <ProgressBadge t={t} />
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <StatusPill value={t.status ?? "pendente"} onChange={(v) => setStatus(t, v)} size="xs" />
                            <DueDate t={t} />
                          </div>
                        </div>
                      ))}
                      {colTasks.length === 0 && (
                        <p className="text-[11px] text-muted-foreground text-center py-4">â€”</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {/* Recurrence editor */}
        {recurEditingId && (() => {
          const t = tasks.find((x) => x.id === recurEditingId);
          if (!t) return null;
          return (
            <Dialog open onOpenChange={(o) => !o && setRecurEditingId(null)}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Recorrência da tarefa</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-sm">
                    <Switch
                      checked={!!t.is_recurring}
                      onCheckedChange={(v) => updateTask(t.id, {
                        is_recurring: v,
                        recurrence_type: v ? (t.recurrence_type ?? "weekly") : null,
                      } as Partial<Task>)}
                    />
                    Repetir esta tarefa
                  </label>
                  {t.is_recurring && (
                    <>
                      <div>
                        <label className="text-xs font-medium">Frequência</label>
                        <Select
                          value={t.recurrence_type ?? "weekly"}
                          onValueChange={(v) => updateTask(t.id, { recurrence_type: v as RecurrenceType } as Partial<Task>)}
                        >
                          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {RECURRENCE_OPTIONS.map((o) => (
                              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-xs font-medium">Intervalo (a cada quantos)</label>
                        <Input
                          type="number" min={1}
                          value={t.recurrence_interval ?? 1}
                          onChange={(e) => updateTask(t.id, { recurrence_interval: Math.max(1, Number(e.target.value) || 1) } as Partial<Task>)}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium">Termina em (opcional)</label>
                        <Input
                          type="date"
                          value={t.recurrence_end_date ?? ""}
                          onChange={(e) => updateTask(t.id, { recurrence_end_date: e.target.value || null } as Partial<Task>)}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        A próxima ocorrência será criada automaticamente quando esta tarefa for marcada como concluída.
                      </p>
                    </>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          );
        })()}

        {/* History dialog */}
        {historyId && (
          <Dialog open onOpenChange={(o) => !o && setHistoryId(null)}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Histórico da tarefa</DialogTitle>
              </DialogHeader>
              <ActivityLogList entityType="task" entityId={historyId} />
            </DialogContent>
          </Dialog>
        )}
        {/* Reminder editor */}
        {reminderTaskId && (() => {
          const t = tasks.find((x) => x.id === reminderTaskId);
          if (!t) return null;
          return (
            <TaskReminderEditor
              open
              onOpenChange={(o) => !o && setReminderTaskId(null)}
              taskId={t.id}
              userId={userId}
              dueDate={t.due_date}
              dueTime={t.due_time ?? null}
              onDueTimeChange={() => load()}
            />
          );
        })()}
      </section>
    </TooltipProvider>
  );
};
