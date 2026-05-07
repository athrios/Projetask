import { Fragment, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "todos">("todos");
  const [priorityFilter, setPriorityFilter] = useState<Priority | "todos">("todos");
  const [view, setView] = useState<ViewMode>(
    () => (lsGet<ViewMode>("tasksView", "list")),
  );

  useEffect(() => {
    localStorage.setItem("tasksView", JSON.stringify(view));
  }, [view]);

  const today = new Date().toISOString().slice(0, 10);

  const load = async () => {
    let query = supabase.from("tasks").select("*");
    if (filter === "all") query = query.eq("task_date", date);
    if (filter === "today") query = query.eq("task_date", today);
    query = query.order("position", { ascending: true }).order("created_at", { ascending: true });
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
  }, [date, filter]);

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
      if (statusFilter !== "todos" && (t.status ?? "pendente") !== statusFilter) return false;
      if (priorityFilter !== "todos" && (t.priority ?? "media") !== priorityFilter) return false;
      return true;
    });
  }, [tasks, search, statusFilter, priorityFilter]);

  const add = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const t = title.trim();
    if (!t) return;
    if (t.length > 200) return toast.error("Título muito longo");
    const targetDate = filter === "today" ? today : date;
    const { error } = await supabase.from("tasks").insert({
      title: t,
      task_date: targetDate,
      user_id: userId,
      position: tasks.length,
    });
    if (error) return toast.error(error.message);
    setTitle("");
    load();
  };

  const updateTask = async (id: string, patch: Partial<Task>) => {
    const { error } = await supabase.from("tasks").update(patch).eq("id", id);
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

  const setStatus = (t: Task, status: TaskStatus) =>
    updateTask(t.id, { status, done: status === "feita" });

  const remove = async (id: string) => {
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) return toast.error(error.message);
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
      .insert({ task_id: taskId, user_id: userId, title: t, position: subs.length });
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
    await supabase.from("subtasks").delete().eq("id", s.id);
    await maybeAutoComplete(s.task_id);
    load();
  };

  const persistNote = (id: string, value: string, kind: "task" | "sub") => {
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
  const flushNote = (id: string, value: string, kind: "task" | "sub") => {
    supabase.from(kind === "task" ? "tasks" : "subtasks").update({ notes: value }).eq("id", id);
  };

  const toggleExpand = (id: string) => setExpanded((p) => ({ ...p, [id]: !p[id] }));
  const toggleNotes = (id: string) => setNotesOpen((p) => ({ ...p, [id]: !p[id] }));

  // ─────────── shared bits ───────────
  const StatusPill = ({
    value,
    onChange,
    size = "sm",
  }: {
    value: TaskStatus;
    onChange: (v: TaskStatus) => void;
    size?: "sm" | "xs";
  }) => (
    <Select value={value} onValueChange={(v) => onChange(v as TaskStatus)}>
      <SelectTrigger
        className={cn(
          "border-0 rounded-full font-medium",
          size === "sm" ? "h-7 w-[110px] text-xs" : "h-6 w-[96px] text-[11px]",
          statusPill[value],
        )}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {TASK_STATUS.map((o) => (
          <SelectItem key={o.value} value={o.value} className="text-xs">
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const PriorityPill = ({
    value,
    onChange,
  }: {
    value: Priority;
    onChange: (v: Priority) => void;
  }) => (
    <Select value={value} onValueChange={(v) => onChange(v as Priority)}>
      <SelectTrigger
        className={cn(
          "h-7 w-[90px] text-xs border-0 rounded-full font-medium",
          priorityPill[value],
        )}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {PRIORITIES.map((o) => (
          <SelectItem key={o.value} value={o.value} className="text-xs">
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
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
        className={cn(
          "flex-1 text-left text-sm leading-snug truncate",
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
                        onClick={() => removeSub(s)}
                        className="p-1 text-muted-foreground hover:text-destructive opacity-0 group-hover/sub:opacity-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </div>
                {noteOpen && (
                  <Textarea
                    value={s.notes}
                    onChange={(e) => persistNote(s.id, e.target.value, "sub")}
                    onBlur={(e) => flushNote(s.id, e.target.value, "sub")}
                    placeholder="Observação..."
                    className="text-xs min-h-[56px] ml-6"
                  />
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

  const RowActions = ({ t }: { t: Task }) => (
    <DropdownMenu>
      <DropdownMenuTrigger className="p-1 text-muted-foreground hover:text-foreground rounded">
        <MoreHorizontal className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onClick={() => startEdit(t)}>
          <Pencil className="h-3.5 w-3.5 mr-2" /> Editar título
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => toggleNotes(`task:${t.id}`)}>
          <StickyNote className="h-3.5 w-3.5 mr-2" /> Observação
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => toggleExpand(t.id)}>
          <ChevronDown className="h-3.5 w-3.5 mr-2" /> Sub-tarefas
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => remove(t.id)} className="text-destructive">
          <Trash2 className="h-3.5 w-3.5 mr-2" /> Remover
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const DueDate = ({ t }: { t: Task }) => (
    <div className="relative">
      <Input
        type="date"
        value={t.due_date ?? ""}
        onChange={(e) => updateTask(t.id, { due_date: e.target.value || null })}
        className="h-7 w-[140px] text-xs border-dashed bg-transparent"
      />
    </div>
  );

  // ─────────── views ───────────
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
          <ProgressBadge t={t} />
          <PriorityPill value={t.priority ?? "media"} onChange={(v) => updateTask(t.id, { priority: v })} />
          <StatusPill value={t.status ?? "pendente"} onChange={(v) => setStatus(t, v)} />
          <DueDate t={t} />
          <RowActions t={t} />
        </div>
        {notesOpen[noteKey] && (
          <div className="px-10 pb-2">
            <Textarea
              value={t.notes}
              onChange={(e) => persistNote(t.id, e.target.value, "task")}
              onBlur={(e) => flushNote(t.id, e.target.value, "task")}
              placeholder="Observação da tarefa..."
              className="text-sm min-h-[60px]"
            />
          </div>
        )}
        {expanded[t.id] && <div className="pb-3">{<SubsBlock t={t} />}</div>}
      </div>
    );
  };

  return (
    <TooltipProvider delayDuration={200}>
      <section className="space-y-5">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar tarefa..."
              className="h-9 pl-8"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as TaskStatus | "todos")}>
            <SelectTrigger className="h-9 w-[140px] text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              {TASK_STATUS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={(v) => setPriorityFilter(v as Priority | "todos")}>
            <SelectTrigger className="h-9 w-[140px] text-xs">
              <SelectValue placeholder="Prioridade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas prioridades</SelectItem>
              {PRIORITIES.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex rounded-md border overflow-hidden bg-card">
            {([
              ["list", List, "Lista"],
              ["table", TableIcon, "Tabela"],
              ["cards", LayoutGrid, "Cards"],
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

        {/* New task */}
        <form onSubmit={add} className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2">
          <Plus className="h-4 w-4 text-muted-foreground" />
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Nova tarefa  (Enter para adicionar)"
            maxLength={200}
            className="border-0 shadow-none focus-visible:ring-0 px-0 h-8 text-sm"
          />
          {title && (
            <Button type="submit" size="sm" className="h-7">
              Adicionar
            </Button>
          )}
        </form>

        {filtered.length === 0 && (
          <div className="rounded-lg border border-dashed bg-card/50 py-10 text-center">
            <p className="text-sm text-muted-foreground">
              {tasks.length === 0 ? "Nenhuma tarefa ainda." : "Nada combina com o filtro."}
            </p>
          </div>
        )}

        {/* List view */}
        {view === "list" && filtered.length > 0 && (
          <div className="rounded-lg border bg-card divide-y">
            {filtered.map(renderListRow)}
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
                              <Textarea
                                value={t.notes}
                                onChange={(e) => persistNote(t.id, e.target.value, "task")}
                                onBlur={(e) => flushNote(t.id, e.target.value, "task")}
                                placeholder="Observação..."
                                className="mb-2 text-sm"
                              />
                            )}
                            {expanded[t.id] && <SubsBlock t={t} />}
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
                <div key={t.id} className="rounded-lg border bg-card p-4 space-y-3 hover:shadow-sm transition">
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
                    <Textarea
                      value={t.notes}
                      onChange={(e) => persistNote(t.id, e.target.value, "task")}
                      onBlur={(e) => flushNote(t.id, e.target.value, "task")}
                      placeholder="Observação..."
                      className="text-sm"
                    />
                  )}
                  {expanded[t.id] && <SubsBlock t={t} />}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </TooltipProvider>
  );
};
