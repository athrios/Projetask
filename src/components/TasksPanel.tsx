import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, Plus, ListTree, ChevronDown } from "lucide-react";
import { toast } from "sonner";

export interface Task {
  id: string;
  title: string;
  done: boolean;
  task_date: string;
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


export const TasksPanel = ({ date, userId, onTasksChange }: Props) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState("");
  const [subtasks, setSubtasks] = useState<Record<string, Subtask[]>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [subInput, setSubInput] = useState<Record<string, string>>({});

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

  const setStatus = async (task: Task, status: "pendente" | "fazendo" | "feita") => {
    const { error } = await supabase
      .from("tasks")
      .update({ status, done: status === "feita" })
      .eq("id", task.id);
    if (error) return toast.error(error.message);
    load();
  };

  const toggle = async (task: Task) => {
    const next = !task.done;
    const { error } = await supabase
      .from("tasks")
      .update({ done: next, status: next ? "feita" : "pendente" })
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

  const maybeAutoComplete = async (taskId: string) => {
    const { data: subs } = await supabase
      .from("subtasks")
      .select("done")
      .eq("task_id", taskId);
    if (!subs || subs.length === 0) return;
    const allDone = subs.every((s) => s.done);
    const { data: t } = await supabase
      .from("tasks")
      .select("status")
      .eq("id", taskId)
      .maybeSingle();
    if (!t) return;
    if (allDone && t.status !== "feita") {
      await supabase
        .from("tasks")
        .update({ status: "feita", done: true })
        .eq("id", taskId);
    } else if (!allDone && t.status === "feita") {
      await supabase
        .from("tasks")
        .update({ status: "fazendo", done: false })
        .eq("id", taskId);
    }
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

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-lg font-semibold tracking-tight">Tarefas isoladas</h2>
        <p className="text-sm text-muted-foreground">Checklist do dia.</p>
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
      <ul className="space-y-1">
        {tasks.length === 0 && (
          <li className="text-sm text-muted-foreground py-4 text-center">Nenhuma tarefa ainda.</li>
        )}
        {tasks.map((t) => {
          const subs = subtasks[t.id] ?? [];
          const isOpen = expanded[t.id];
          return (
            <li key={t.id} className="rounded-md hover:bg-secondary/40">
              <div className="flex items-center gap-2 px-3 py-2 group">
                <Checkbox checked={t.done} onCheckedChange={() => toggle(t)} />
                <span className={`flex-1 text-sm ${t.done ? "line-through text-muted-foreground" : ""}`}>
                  {t.title}
                  {subs.length > 0 && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      ({subs.filter((s) => s.done).length}/{subs.length})
                    </span>
                  )}
                </span>
                <button
                  onClick={() => toggleExpand(t.id)}
                  className="text-muted-foreground hover:text-foreground transition"
                  aria-label="Sub-tarefas"
                  title="Sub-tarefas"
                >
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ListTree className="h-4 w-4" />
                  )}
                </button>
                <button
                  onClick={() => remove(t.id)}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition"
                  aria-label="Remover"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              {isOpen && (
                <div className="pl-10 pr-3 pb-3 space-y-2">
                  <ul className="space-y-1">
                    {subs.map((s) => (
                      <li key={s.id} className="flex items-center gap-2 group/sub">
                        <Checkbox checked={s.done} onCheckedChange={() => toggleSub(s)} />
                        <span className={`flex-1 text-sm ${s.done ? "line-through text-muted-foreground" : ""}`}>
                          {s.title}
                        </span>
                        <button
                          onClick={() => removeSub(s)}
                          className="opacity-0 group-hover/sub:opacity-100 text-muted-foreground hover:text-destructive transition"
                          aria-label="Remover sub-tarefa"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    ))}
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
                      onChange={(e) =>
                        setSubInput((p) => ({ ...p, [t.id]: e.target.value }))
                      }
                      placeholder="Nova sub-tarefa..."
                      maxLength={200}
                      className="h-8 text-sm"
                    />
                    <Button type="submit" size="icon" className="h-8 w-8" aria-label="Adicionar sub-tarefa">
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </form>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
};
