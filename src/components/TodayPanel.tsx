import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SchedulePanel } from "./SchedulePanel";
import { TasksPanel, type Task } from "./TasksPanel";
import { CalendarClock, ListChecks, CheckCircle2, Flame } from "lucide-react";

interface Props {
  date: string;
  userId: string;
}

export const TodayPanel = ({ date, userId }: Props) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [scheduleCount, setScheduleCount] = useState(0);

  useEffect(() => {
    supabase
      .from("schedule_items")
      .select("id", { count: "exact", head: true })
      .eq("task_date", date)
      .then(({ count }) => setScheduleCount(count ?? 0));
  }, [date, tasks.length]);

  const total = tasks.length;
  const done = tasks.filter((t) => t.done).length;
  const doing = tasks.filter((t) => t.status === "fazendo").length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={ListChecks} label="Tarefas" value={total} />
        <Stat icon={Flame} label="Em andamento" value={doing} />
        <Stat icon={CheckCircle2} label="Concluídas" value={`${done}/${total}`} hint={`${pct}%`} />
        <Stat icon={CalendarClock} label="Blocos no cronograma" value={scheduleCount} />
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_1fr] gap-6">
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Cronograma de hoje
          </h3>
          <SchedulePanel date={date} userId={userId} tasks={tasks} />
        </div>
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Tarefas de hoje
          </h3>
          <TasksPanel date={date} userId={userId} filter="today" onTasksChange={setTasks} />
        </div>
      </div>
    </div>
  );
};

const Stat = ({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof ListChecks;
  label: string;
  value: number | string;
  hint?: string;
}) => (
  <div className="rounded-lg border bg-card p-4">
    <div className="flex items-center gap-2 text-muted-foreground text-xs">
      <Icon className="h-3.5 w-3.5" />
      {label}
    </div>
    <div className="mt-1 flex items-baseline gap-2">
      <span className="text-2xl font-semibold tabular-nums">{value}</span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  </div>
);
