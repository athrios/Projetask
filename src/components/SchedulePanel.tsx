import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import type { Task } from "./TasksPanel";

interface ScheduleItem {
  id: string;
  start_time: string; // HH:MM:SS
  title: string;
  duration_minutes: number;
  position: number;
  task_date: string;
}

interface Props {
  date: string;
  userId: string;
  tasks: Task[];
}

// Durations: 5, 10, 15, then +15 up to 240
const DURATIONS: number[] = [5, 10, 15, ...Array.from({ length: 15 }, (_, i) => 30 + i * 15)];

const fmt = (t: string) => t.slice(0, 5);

const addMinutes = (time: string, mins: number) => {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + mins;
  const nh = Math.floor((total % (24 * 60)) / 60);
  const nm = total % 60;
  return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`;
};

export const SchedulePanel = ({ date, userId, tasks }: Props) => {
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [start, setStart] = useState("09:00");
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState(15);
  const [taskPick, setTaskPick] = useState<string>("");

  const load = async () => {
    const { data, error } = await supabase
      .from("schedule_items")
      .select("*")
      .eq("task_date", date)
      .order("start_time", { ascending: true });
    if (error) return toast.error(error.message);
    setItems(data ?? []);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  // Auto-fill next start when last item changes
  useEffect(() => {
    if (items.length > 0) {
      const last = items[items.length - 1];
      setStart(addMinutes(last.start_time.slice(0, 5), last.duration_minutes));
    }
  }, [items]);

  const onPickTask = (val: string) => {
    setTaskPick(val);
    const found = tasks.find((t) => t.id === val);
    if (found) setTitle(found.title);
  };

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    if (!t) return toast.error("Informe a tarefa");
    if (t.length > 200) return toast.error("Título muito longo");
    const { error } = await supabase.from("schedule_items").insert({
      user_id: userId,
      task_date: date,
      start_time: start + ":00",
      title: t,
      duration_minutes: duration,
      position: items.length,
    });
    if (error) return toast.error(error.message);
    setTitle("");
    setTaskPick("");
    load();
  };

  const updateItem = async (id: string, patch: Partial<ScheduleItem>) => {
    const { error } = await supabase.from("schedule_items").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("schedule_items").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-lg font-semibold tracking-tight">Cronograma diário</h2>
        <p className="text-sm text-muted-foreground">
          Encadeie tarefas por horário. Ajuste o início se quiser intervalos.
        </p>
      </header>

      <form onSubmit={add} className="grid grid-cols-12 gap-2 items-end p-3 rounded-lg border bg-card">
        <div className="col-span-12 sm:col-span-2">
          <label className="text-xs text-muted-foreground">Início</label>
          <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div className="col-span-12 sm:col-span-6 space-y-1">
          <label className="text-xs text-muted-foreground">Tarefa</label>
          {tasks.length > 0 && (
            <Select value={taskPick} onValueChange={onPickTask}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Escolher das tarefas isoladas..." />
              </SelectTrigger>
              <SelectContent>
                {tasks.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ou escreva uma nova tarefa..."
            maxLength={200}
          />
        </div>
        <div className="col-span-8 sm:col-span-3">
          <label className="text-xs text-muted-foreground">Duração</label>
          <Select value={String(duration)} onValueChange={(v) => setDuration(Number(v))}>
            <SelectTrigger>
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
        </div>
        <div className="col-span-4 sm:col-span-1">
          <Button type="submit" size="icon" className="w-full" aria-label="Adicionar">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </form>

      <ul className="space-y-1">
        {items.length === 0 && (
          <li className="text-sm text-muted-foreground py-6 text-center">
            Nenhum bloco no cronograma ainda.
          </li>
        )}
        {items.map((it) => {
          const end = addMinutes(it.start_time.slice(0, 5), it.duration_minutes);
          return (
            <li
              key={it.id}
              className="grid grid-cols-12 gap-2 items-center px-3 py-2 rounded-md hover:bg-secondary/60 group"
            >
              <div className="col-span-3 sm:col-span-2 flex items-center gap-2">
                <Input
                  type="time"
                  value={fmt(it.start_time)}
                  onChange={(e) => updateItem(it.id, { start_time: e.target.value + ":00" })}
                  className="h-8 text-xs"
                />
              </div>
              <div className="col-span-6 sm:col-span-6 text-sm truncate">{it.title}</div>
              <div className="col-span-2 sm:col-span-3 flex items-center gap-2">
                <Select
                  value={String(it.duration_minutes)}
                  onValueChange={(v) => updateItem(it.id, { duration_minutes: Number(v) })}
                >
                  <SelectTrigger className="h-8 text-xs">
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
                <span className="text-xs text-muted-foreground whitespace-nowrap hidden sm:inline">
                  → {end}
                </span>
              </div>
              <div className="col-span-1 flex justify-end">
                <button
                  onClick={() => remove(it.id)}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition"
                  aria-label="Remover"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
};
