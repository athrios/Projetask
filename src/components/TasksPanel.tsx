import { Fragment, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
  Trash2,
  Plus,
  ListTree,
  ChevronDown,
  StickyNote,
  List,
  TableIcon,
  LayoutGrid,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface Task {
  id: string;
  title: string;
  done: boolean;
  task_date: string;
  status?: "pendente" | "fazendo" | "feita";
}

interface Subtask {
  id: string;
  task_id: string;
  title: string;
  done: boolean;
}

interface Props {
  date: string;
  userId: string;
  onTasksChange?: (tasks: Task[]) => void;
}

type ViewMode = "list" | "table" | "cards";
const STATUS_OPTIONS = [
  { value: "pendente", label: "Pendente" },
  { value: "fazendo", label: "Fazendo" },
  { value: "feita", label: "Feita" },
] as const;

const statusColor: Record<string, string> = {
  pendente: "bg-muted text-muted-foreground",
  fazendo: "bg-primary/15 text-primary",
  feita: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
};

// Notes are kept locally for now (no backend changes)
const notesKey = (userId: string) => `taskNotes:${userId}`;
const loadNotes = (userId: string): Record<string, string> => {
  try {
    return JSON.parse(localStorage.getItem(notesKey(userId)) || "{}");
  } catch {
    return {};
  }
};
const saveNotes = (userId: string, n: Record<string, string>) =>
  localStorage.setItem(notesKey(userId), JSON.stringify(n));

const subStatusKey = (userId: string) => `subStatus:${userId}`;
const loadSubStatus = (userId: string): Record<string, string> => {
  try {
    return JSON.parse(localStorage.getItem(subStatusKey(userId)) || "{}");
  } catch {
    return {};
  }
};
const saveSubStatus = (userId: string, n: Record<string, string>) =>
  localStorage.setItem(subStatusKey(userId), JSON.stringify(n));

export const TasksPanel = ({ date, userId, onTasksChange }: Props) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState("");
  const [subtasks, setSubtasks] = useState<Record<string, Subtask[]>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [subInput, setSubInput] = useState<Record<string, string>>({});
  const [notesOpen, setNotesOpen] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState<Record<string, string>>(() => loadNotes(userId));

  const [view, setView] = useState<ViewMode>(
    () => (localStorage.getItem("tasksView") as ViewMode) || "list",
  );
  const [statusOnTasks, setStatusOnTasks] = useState(
    () => localStorage.getItem("statusOnTasks") !== "false",
  );
  const [statusOnSubs, setStatusOnSubs] = useState(
    () => localStorage.getItem("statusOnSubs") === "true",
  );

  useEffect(() => localStorage.setItem("tasksView", view), [view]);
  useEffect(() => localStorage.setItem("statusOnTasks", String(statusOnTasks)), [statusOnTasks]);
  useEffect(() => localStorage.setItem("statusOnSubs", String(statusOnSubs)), [statusOnSubs]);

  const persistNote = (key: string, value: string) => {
    const next = { ...notes, [key]: value };
    if (!value) delete next[key];
    setNotes(next);
    saveNotes(userId, next);
  };

  const load = async () => {
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("task_date", date)
      .order("created_at", { ascending: true });
    if (error) return toast.error(error.message);
    const list = (data ?? []) as Task[];
    setTasks(list);
    onTasksChange?.(list);
    if (list.length) {
      const { data: subs } = await supabase
        .from("subtasks")
        .select("*")
        .in("task_id", list.map((t) => t.id))
        .order("created_at", { ascending: true });
      const grouped: Record<string, Subtask[]> = {};
      (subs ?? []).forEach((s: Subtask) => {
        (grouped[s.task_id] ||= []).push(s);
      });
      setSubtasks(grouped);
    } else {
      setSubtasks({});
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    if (t.length > 200) return toast.error("Título muito longo");
    const { error } = await supabase
      .from("tasks")
      .insert({ title: t, task_date: date, user_id: userId });
    if (error) return toast.error(error.message);
    setTitle("");
    load();
  };

  const toggle = async (task: Task) => {
    const { error } = await supabase
      .from("tasks")
      .update({ done: !task.done })
      .eq("id", task.id);
    if (error) return toast.error(error.message);
    load();
  };

  const updateTaskStatus = async (task: Task, status: string) => {
    const { error } = await supabase
      .from("tasks")
      .update({ status, done: status === "feita" })
      .eq("id", task.id);
    if (error) return toast.error(error.message);
    load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const toggleExpand = (id: string) =>
    setExpanded((p) => ({ ...p, [id]: !p[id] }));
  const toggleNotes = (id: string) =>
    setNotesOpen((p) => ({ ...p, [id]: !p[id] }));

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
    if (t.length > 200) return toast.error("Título muito longo");
    const { error } = await supabase
      .from("subtasks")
      .insert({ task_id: taskId, user_id: userId, title: t });
    if (error) return toast.error(error.message);
    setSubInput((p) => ({ ...p, [taskId]: "" }));
    await maybeAutoComplete(taskId);
    load();
  };

  const toggleSub = async (s: Subtask) => {
    const { error } = await supabase
      .from("subtasks")
      .update({ done: !s.done })
      .eq("id", s.id);
    if (error) return toast.error(error.message);
    await maybeAutoComplete(s.task_id);
    load();
  };

  const removeSub = async (s: Subtask) => {
    const { error } = await supabase.from("subtasks").delete().eq("id", s.id);
    if (error) return toast.error(error.message);
    await maybeAutoComplete(s.task_id);
    load();
  };

  const StatusBadge = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={`h-7 w-[110px] text-xs border-0 rounded-full ${statusColor[value]}`}>
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
  );

  const renderSubsBlock = (t: Task) => {
    const subs = subtasks[t.id] ?? [];
    return (
      <div className="space-y-2">
        <ul className="space-y-1">
          {subs.map((s) => {
            const noteKey = `sub:${s.id}`;
            const noteOpen = notesOpen[noteKey];
            return (
              <li key={s.id} className="space-y-1">
                <div className="flex items-center gap-2 group/sub">
                  <Checkbox checked={s.done} onCheckedChange={() => toggleSub(s)} />
                  <span className={`flex-1 text-sm ${s.done ? "line-through text-muted-foreground" : ""}`}>
                    {s.title}
                  </span>
                  {statusOnSubs && (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor[s.done ? "feita" : "pendente"]}`}>
                      {s.done ? "Feita" : "Pendente"}
                    </span>
                  )}
                  <button
                    onClick={() => toggleNotes(noteKey)}
                    className={cn(
                      "transition",
                      notes[noteKey]
                        ? "text-primary"
                        : "text-muted-foreground opacity-0 group-hover/sub:opacity-100",
                    )}
                    aria-label="Observação"
                    title="Observação"
                  >
                    <StickyNote className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => removeSub(s)}
                    className="opacity-0 group-hover/sub:opacity-100 text-muted-foreground hover:text-destructive transition"
                    aria-label="Remover sub-tarefa"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                {noteOpen && (
                  <Textarea
                    value={notes[noteKey] ?? ""}
                    onChange={(e) => persistNote(noteKey, e.target.value)}
                    placeholder="Observação da sub-tarefa..."
                    className="text-xs min-h-[60px] ml-6"
                  />
                )}
              </li>
            );
          })}
          {subs.length === 0 && (
            <li className="text-xs text-muted-foreground">Nenhuma sub-tarefa.</li>
          )}
        </ul>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            addSub(t.id);
          }}
          className="flex gap-2"
        >
          <Input
            value={subInput[t.id] ?? ""}
            onChange={(e) => setSubInput((p) => ({ ...p, [t.id]: e.target.value }))}
            placeholder="Nova sub-tarefa..."
            maxLength={200}
            className="h-8 text-sm"
          />
          <Button type="submit" size="icon" className="h-8 w-8" aria-label="Adicionar sub-tarefa">
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </form>
      </div>
    );
  };

  const renderControls = (t: Task) => {
    const subs = subtasks[t.id] ?? [];
    const noteKey = `task:${t.id}`;
    return (
      <div className="flex items-center gap-1.5">
        {subs.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {subs.filter((s) => s.done).length}/{subs.length}
          </span>
        )}
        {statusOnTasks && (
          <StatusBadge
            value={t.status ?? (t.done ? "feita" : "pendente")}
            onChange={(v) => updateTaskStatus(t, v)}
          />
        )}
        <button
          onClick={() => toggleExpand(t.id)}
          className="text-muted-foreground hover:text-foreground transition p-1"
          aria-label="Sub-tarefas"
          title="Sub-tarefas"
        >
          {expanded[t.id] ? <ChevronDown className="h-4 w-4" /> : <ListTree className="h-4 w-4" />}
        </button>
        <button
          onClick={() => toggleNotes(noteKey)}
          className={cn(
            "transition p-1",
            notes[noteKey] ? "text-primary" : "text-muted-foreground hover:text-foreground",
          )}
          aria-label="Observação"
          title="Observação"
        >
          <StickyNote className="h-4 w-4" />
        </button>
        <button
          onClick={() => remove(t.id)}
          className="text-muted-foreground hover:text-destructive transition p-1"
          aria-label="Remover"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    );
  };

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Tarefas isoladas</h2>
          <p className="text-sm text-muted-foreground">Checklist do dia.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch id="st-task" checked={statusOnTasks} onCheckedChange={setStatusOnTasks} />
            <Label htmlFor="st-task" className="text-xs">Status nas tarefas</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="st-sub" checked={statusOnSubs} onCheckedChange={setStatusOnSubs} />
            <Label htmlFor="st-sub" className="text-xs">Status nas sub-tarefas</Label>
          </div>
          <div className="flex rounded-md border overflow-hidden">
            {([
              ["list", List],
              ["table", TableIcon],
              ["cards", LayoutGrid],
            ] as const).map(([m, Icon]) => (
              <button
                key={m}
                onClick={() => setView(m)}
                className={cn(
                  "px-2 py-1.5 text-xs",
                  view === m ? "bg-primary text-primary-foreground" : "hover:bg-secondary",
                )}
                aria-label={m}
              >
                <Icon className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>
        </div>
      </header>

      <form onSubmit={add} className="flex gap-2">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Nova tarefa..."
          maxLength={200}
        />
        <Button type="submit" size="icon" aria-label="Adicionar">
          <Plus className="h-4 w-4" />
        </Button>
      </form>

      {tasks.length === 0 && (
        <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma tarefa ainda.</p>
      )}

      {view === "list" && (
        <ul className="space-y-1">
          {tasks.map((t) => {
            const noteKey = `task:${t.id}`;
            return (
              <li key={t.id} className="rounded-md hover:bg-secondary/40">
                <div className="flex items-center gap-2 px-3 py-2">
                  <Checkbox checked={t.done} onCheckedChange={() => toggle(t)} />
                  <span className={`flex-1 text-sm ${t.done ? "line-through text-muted-foreground" : ""}`}>
                    {t.title}
                  </span>
                  {renderControls(t)}
                </div>
                {notesOpen[noteKey] && (
                  <div className="px-3 pb-3">
                    <Textarea
                      value={notes[noteKey] ?? ""}
                      onChange={(e) => persistNote(noteKey, e.target.value)}
                      placeholder="Observação da tarefa..."
                      className="text-sm min-h-[70px]"
                    />
                  </div>
                )}
                {expanded[t.id] && <div className="pl-10 pr-3 pb-3">{renderSubsBlock(t)}</div>}
              </li>
            );
          })}
        </ul>
      )}

      {view === "table" && (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead>Tarefa</TableHead>
                <TableHead className="w-24">Sub</TableHead>
                {statusOnTasks && <TableHead className="w-32">Status</TableHead>}
                <TableHead className="w-32 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((t) => {
                const subs = subtasks[t.id] ?? [];
                const noteKey = `task:${t.id}`;
                return (
                  <Fragment key={t.id}>
                    <TableRow key={t.id}>
                      <TableCell>
                        <Checkbox checked={t.done} onCheckedChange={() => toggle(t)} />
                      </TableCell>
                      <TableCell className={t.done ? "line-through text-muted-foreground" : ""}>
                        {t.title}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {subs.length ? `${subs.filter((s) => s.done).length}/${subs.length}` : "—"}
                      </TableCell>
                      {statusOnTasks && (
                        <TableCell>
                          <StatusBadge
                            value={t.status ?? (t.done ? "feita" : "pendente")}
                            onChange={(v) => updateTaskStatus(t, v)}
                          />
                        </TableCell>
                      )}
                      <TableCell className="text-right">
                        <div className="inline-flex">
                          <button onClick={() => toggleExpand(t.id)} className="p-1 text-muted-foreground hover:text-foreground" aria-label="Sub">
                            <ListTree className="h-4 w-4" />
                          </button>
                          <button onClick={() => toggleNotes(noteKey)} className={cn("p-1", notes[noteKey] ? "text-primary" : "text-muted-foreground hover:text-foreground")} aria-label="Notas">
                            <StickyNote className="h-4 w-4" />
                          </button>
                          <button onClick={() => remove(t.id)} className="p-1 text-muted-foreground hover:text-destructive" aria-label="Remover">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {(notesOpen[noteKey] || expanded[t.id]) && (
                      <TableRow key={t.id + "-x"}>
                        <TableCell colSpan={statusOnTasks ? 5 : 4} className="bg-muted/30">
                          {notesOpen[noteKey] && (
                            <Textarea
                              value={notes[noteKey] ?? ""}
                              onChange={(e) => persistNote(noteKey, e.target.value)}
                              placeholder="Observação da tarefa..."
                              className="text-sm mb-2"
                            />
                          )}
                          {expanded[t.id] && renderSubsBlock(t)}
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

      {view === "cards" && (
        <div className="grid sm:grid-cols-2 gap-3">
          {tasks.map((t) => {
            const noteKey = `task:${t.id}`;
            return (
              <div key={t.id} className="rounded-lg border bg-card p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <Checkbox checked={t.done} onCheckedChange={() => toggle(t)} className="mt-0.5" />
                  <span className={`flex-1 text-sm ${t.done ? "line-through text-muted-foreground" : ""}`}>
                    {t.title}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  {statusOnTasks ? (
                    <StatusBadge
                      value={t.status ?? (t.done ? "feita" : "pendente")}
                      onChange={(v) => updateTaskStatus(t, v)}
                    />
                  ) : <span />}
                  {renderControls(t)}
                </div>
                {notesOpen[noteKey] && (
                  <Textarea
                    value={notes[noteKey] ?? ""}
                    onChange={(e) => persistNote(noteKey, e.target.value)}
                    placeholder="Observação..."
                    className="text-sm min-h-[60px]"
                  />
                )}
                {expanded[t.id] && renderSubsBlock(t)}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
