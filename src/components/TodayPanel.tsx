import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { SchedulePanel } from "./SchedulePanel";
import { TasksPanel, type Task } from "./TasksPanel";
import {
  CalendarClock,
  ListChecks,
  CheckCircle2,
  Flame,
  AlertTriangle,
  Workflow,
  Inbox,
} from "lucide-react";

interface Props {
  date: string;
  userId: string;
}

interface OverdueTask {
  id: string;
  title: string;
  task_date: string;
}

interface PendingRequest {
  id: string;
  submitter_name: string;
  created_at: string;
}

export const TodayPanel = ({ date, userId }: Props) => {
  const { workspaceId } = useWorkspace();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [scheduleCount, setScheduleCount] = useState(0);
  const [overdue, setOverdue] = useState<OverdueTask[]>([]);
  const [activeProcesses, setActiveProcesses] = useState(0);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);

  useEffect(() => {
    if (!workspaceId) return;
    supabase
      .from("schedule_items")
      .select("id", { count: "exact", head: true })
      .eq("task_date", date)
      .eq("workspace_id", workspaceId)
      .then(({ count }) => setScheduleCount(count ?? 0));

    supabase
      .from("tasks")
      .select("id,title,task_date")
      .eq("workspace_id", workspaceId)
      .lt("task_date", date)
      .not("status", "in", "(feita,cancelado)")
      .order("task_date", { ascending: true })
      .limit(5)
      .then(({ data }) => setOverdue((data ?? []) as OverdueTask[]));

    supabase
      .from("processes")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .in("status", ["em_andamento", "aguardando_cliente", "aguardando_orgao", "em_exigencia"])
      .then(({ count }) => setActiveProcesses(count ?? 0));

    supabase
      .from("form_responses")
      .select("id,submitter_name,created_at")
      .eq("workspace_id", workspaceId)
      .in("status", ["recebida", "em_analise"])
      .order("created_at", { ascending: false })
      .limit(5)
      .then(({ data }) => setPendingRequests((data ?? []) as PendingRequest[]));
  }, [date, tasks.length, workspaceId]);

  const total = tasks.length;
  const done = tasks.filter((t) => t.done).length;
  const doing = tasks.filter((t) => t.status === "fazendo").length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <Stat icon={ListChecks} label="Tarefas" value={total} />
        <Stat icon={Flame} label="Em andamento" value={doing} />
        <Stat icon={CheckCircle2} label="Concluídas" value={`${done}/${total}`} hint={`${pct}%`} />
        <Stat icon={AlertTriangle} label="Atrasadas" value={overdue.length} accent={overdue.length > 0} />
        <Stat icon={Workflow} label="Processos ativos" value={activeProcesses} />
        <Stat icon={CalendarClock} label="Cronograma" value={scheduleCount} />
      </div>

      {(overdue.length > 0 || pendingRequests.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {overdue.length > 0 && (
            <div className="spotlight rounded-xl border border-[hsl(var(--prio-urgente))]/30 bg-card p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--prio-urgente))] flex items-center gap-1.5 mb-2">
                <AlertTriangle className="h-3.5 w-3.5" />
                Tarefas atrasadas
              </h3>
              <ul className="divide-y">
                {overdue.map((t) => (
                  <li key={t.id} className="spotlight-sm rounded-md px-2 py-1.5 -mx-2 flex items-center justify-between gap-2">
                    <span className="text-sm truncate">{t.title}</span>
                    <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
                      {new Date(t.task_date).toLocaleDateString("pt-BR")}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {pendingRequests.length > 0 && (
            <div className="spotlight rounded-xl border bg-card p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5 mb-2">
                <Inbox className="h-3.5 w-3.5" />
                Solicitações pendentes
              </h3>
              <ul className="divide-y">
                {pendingRequests.map((r) => (
                  <li key={r.id} className="spotlight-sm rounded-md px-2 py-1.5 -mx-2 flex items-center justify-between gap-2">
                    <span className="text-sm truncate">{r.submitter_name || "Anônimo"}</span>
                    <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
                      {new Date(r.created_at).toLocaleDateString("pt-BR")}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

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
  accent,
}: {
  icon: typeof ListChecks;
  label: string;
  value: number | string;
  hint?: string;
  accent?: boolean;
}) => (
  <div className={`spotlight rounded-xl border bg-card p-4 ${accent ? "border-[hsl(var(--prio-urgente))]/40" : ""}`}>
    <div className="flex items-center gap-2 text-muted-foreground text-xs">
      <Icon className={`h-3.5 w-3.5 ${accent ? "text-[hsl(var(--prio-urgente))]" : ""}`} />
      {label}
    </div>
    <div className="mt-1 flex items-baseline gap-2">
      <span className={`text-2xl font-semibold tabular-nums ${accent ? "text-[hsl(var(--prio-urgente))]" : ""}`}>
        {value}
      </span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  </div>
);
