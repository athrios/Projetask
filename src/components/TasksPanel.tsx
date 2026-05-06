import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

export interface Task {
  id: string;
  title: string;
  done: boolean;
  task_date: string;
}

interface Props {
  date: string;
  userId: string;
  onTasksChange?: (tasks: Task[]) => void;
}

export const TasksPanel = ({ date, userId, onTasksChange }: Props) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState("");

  const load = async () => {
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("task_date", date)
      .order("created_at", { ascending: true });
    if (error) return toast.error(error.message);
    setTasks(data ?? []);
    onTasksChange?.(data ?? []);
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

  const remove = async (id: string) => {
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) return toast.error(error.message);
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
        {tasks.map((t) => (
          <li
            key={t.id}
            className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-secondary/60 group"
          >
            <Checkbox checked={t.done} onCheckedChange={() => toggle(t)} />
            <span className={`flex-1 text-sm ${t.done ? "line-through text-muted-foreground" : ""}`}>
              {t.title}
            </span>
            <button
              onClick={() => remove(t.id)}
              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition"
              aria-label="Remover"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
};
