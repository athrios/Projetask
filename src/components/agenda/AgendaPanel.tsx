import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ListChecks, Workflow, CalendarClock, AlertCircle } from "lucide-react";
import { StatusPill } from "@/components/shared/StatusPill";
import { PriorityPill } from "@/components/shared/PriorityPill";
import { EmptyState } from "@/components/shared/EmptyState";
import type { TaskStatus, Priority, ProcessStatus } from "@/lib/taskTokens";

type AgendaView = "day" | "week" | "month";

interface AgendaTask {
  id: string;
  title: string;
  due_date: string | null;
  task_date: string;
  status: TaskStatus;
  priority: Priority;
  done: boolean;
}
interface AgendaProcess {
  id: string;
  name: string;
  client_name: string;
  status: ProcessStatus;
  due_date: string | null;
}

interface Props { userId: string }

const todayISO = () => new Date().toISOString().slice(0, 10);
const fmt = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" });

const startOfWeek = (d: Date) => {
  const x = new Date(d);
  const dow = x.getDay();
  x.setDate(x.getDate() - dow);
  return x;
};

const isoOf = (d: Date) => d.toISOString().slice(0, 10);

export const AgendaPanel = ({ userId: _userId }: Props) => {
  const [view, setView] = useState<AgendaView>("week");
  const [anchor, setAnchor] = useState<string>(todayISO());
  const [tasks, setTasks] = useState<AgendaTask[]>([]);
  const [processes, setProcesses] = useState<AgendaProcess[]>([]);

  useEffect(() => {
    (async () => {
      const [t, p] = await Promise.all([
        supabase.from("tasks").select("id,title,due_date,task_date,status,priority,done"),
        supabase.from("processes").select("id,name,client_name,status,due_date"),
      ]);
      setTasks((t.data ?? []) as AgendaTask[]);
      setProcesses((p.data ?? []) as AgendaProcess[]);
    })();
  }, []);

  const today = todayISO();

  const range = useMemo(() => {
    const a = new Date(anchor + "T00:00:00");
    if (view === "day") return [isoOf(a)];
    if (view === "week") {
      const s = startOfWeek(a);
      return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(s);
        d.setDate(s.getDate() + i);
        return isoOf(d);
      });
    }
    // month
    const first = new Date(a.getFullYear(), a.getMonth(), 1);
    const last = new Date(a.getFullYear(), a.getMonth() + 1, 0);
    const days: string[] = [];
    for (let i = 1; i <= last.getDate(); i++) days.push(isoOf(new Date(first.getFullYear(), first.getMonth(), i)));
    return days;
  }, [anchor, view]);

  const dateOf = (t: AgendaTask) => t.due_date ?? t.task_date;
  const overdueTasks = tasks.filter((t) => !t.done && t.due_date && t.due_date < today);
  const noDueTasks = tasks.filter((t) => !t.due_date && !t.done);
  const noDueProcs = processes.filter((p) => !p.due_date && p.status !== "concluido" && p.status !== "cancelado");

  const tasksFor = (iso: string) => tasks.filter((t) => dateOf(t) === iso);
  const procsFor = (iso: string) => processes.filter((p) => p.due_date === iso);

  const shift = (delta: number) => {
    const a = new Date(anchor + "T00:00:00");
    if (view === "day") a.setDate(a.getDate() + delta);
    if (view === "week") a.setDate(a.getDate() + delta * 7);
    if (view === "month") a.setMonth(a.getMonth() + delta);
    setAnchor(isoOf(a));
  };

  return (
    <div className="space-y-5">
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="inline-flex rounded-md border bg-card p-0.5">
          {(["day", "week", "month"] as AgendaView[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                "px-3 h-7 text-xs font-medium rounded transition-colors",
                view === v ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {v === "day" ? "Hoje" : v === "week" ? "Semana" : "Mês"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="outline" onClick={() => shift(-1)} className="h-8 px-2">‹</Button>
          <Button size="sm" variant="outline" onClick={() => setAnchor(today)} className="h-8 text-xs">Hoje</Button>
          <Button size="sm" variant="outline" onClick={() => shift(1)} className="h-8 px-2">›</Button>
        </div>
      </div>

      {overdueTasks.length > 0 && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="h-4 w-4 text-destructive" />
            <h4 className="text-sm font-semibold">Atrasadas ({overdueTasks.length})</h4>
          </div>
          <ul className="space-y-1.5">
            {overdueTasks.slice(0, 5).map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-2 text-xs">
                <span className="truncate">{t.title}</span>
                <span className="text-destructive tabular-nums">{t.due_date}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* views */}
      {view === "month" ? (
        <MonthGrid range={range} tasks={tasks} processes={processes} dateOf={dateOf} today={today} />
      ) : (
        <div className="space-y-3">
          {range.map((iso) => {
            const ts = tasksFor(iso);
            const ps = procsFor(iso);
            const isToday = iso === today;
            if (ts.length === 0 && ps.length === 0 && view === "week") {
              return (
                <div key={iso} className={cn("rounded-lg border bg-card/50 px-4 py-2", isToday && "border-foreground/40")}>
                  <p className="text-xs text-muted-foreground">{fmt(iso)} — vazio</p>
                </div>
              );
            }
            return (
              <div key={iso} className={cn("rounded-xl border bg-card", isToday && "border-foreground/40")}>
                <div className={cn("px-4 py-2 border-b text-xs font-medium", isToday && "bg-secondary/50")}>
                  {fmt(iso)} {isToday && <span className="ml-2 text-[10px] uppercase tracking-wide text-foreground/70">Hoje</span>}
                </div>
                <div className="divide-y">
                  {ts.map((t) => (
                    <div key={t.id} className="px-4 py-2 flex items-center gap-2 text-sm">
                      <ListChecks className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className={cn("flex-1 truncate", t.done && "line-through text-muted-foreground")}>{t.title}</span>
                      <PriorityPill value={t.priority ?? "media"} />
                      <StatusPill domain="task" value={t.status ?? "pendente"} size="xs" />
                    </div>
                  ))}
                  {ps.map((p) => (
                    <div key={p.id} className="px-4 py-2 flex items-center gap-2 text-sm">
                      <Workflow className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="flex-1 truncate">{p.name}</span>
                      <StatusPill domain="process" value={p.status} size="xs" />
                    </div>
                  ))}
                  {ts.length === 0 && ps.length === 0 && (
                    <p className="px-4 py-3 text-xs text-muted-foreground">Nada agendado.</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* No due */}
      {(noDueTasks.length > 0 || noDueProcs.length > 0) && (
        <div className="rounded-xl border bg-card/50">
          <div className="px-4 py-2 border-b text-xs font-medium flex items-center gap-2">
            <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
            Sem prazo
            <span className="text-muted-foreground">({noDueTasks.length + noDueProcs.length})</span>
          </div>
          <div className="divide-y">
            {noDueTasks.map((t) => (
              <div key={t.id} className="px-4 py-2 flex items-center gap-2 text-sm">
                <ListChecks className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="flex-1 truncate">{t.title}</span>
                <StatusPill domain="task" value={t.status ?? "pendente"} size="xs" />
              </div>
            ))}
            {noDueProcs.map((p) => (
              <div key={p.id} className="px-4 py-2 flex items-center gap-2 text-sm">
                <Workflow className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="flex-1 truncate">{p.name}</span>
                <StatusPill domain="process" value={p.status} size="xs" />
              </div>
            ))}
          </div>
        </div>
      )}

      {tasks.length === 0 && processes.length === 0 && (
        <EmptyState
          icon={CalendarClock}
          title="Sua agenda está vazia"
          description="Crie tarefas ou processos com prazo para vê-los aqui."
        />
      )}
    </div>
  );
};

const MonthGrid = ({
  range, tasks, processes, dateOf, today,
}: {
  range: string[];
  tasks: AgendaTask[];
  processes: AgendaProcess[];
  dateOf: (t: AgendaTask) => string;
  today: string;
}) => {
  const first = new Date(range[0] + "T00:00:00");
  const padStart = first.getDay();
  const cells: (string | null)[] = [...Array(padStart).fill(null), ...range];
  while (cells.length % 7 !== 0) cells.push(null);
  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="grid grid-cols-7 text-[11px] uppercase tracking-wide text-muted-foreground bg-muted/40">
        {["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"].map((d) => (
          <div key={d} className="px-2 py-1.5 text-center">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((iso, i) => {
          if (!iso) return <div key={i} className="min-h-[80px] border-t border-r last:border-r-0 bg-muted/10" />;
          const ts = tasks.filter((t) => dateOf(t) === iso);
          const ps = processes.filter((p) => p.due_date === iso);
          const overdue = ts.some((t) => !t.done && iso < today);
          return (
            <div key={i} className={cn(
              "min-h-[80px] border-t border-r last:border-r-0 p-1.5 text-[11px] space-y-1",
              iso === today && "bg-secondary/40",
            )}>
              <div className={cn("font-medium tabular-nums", overdue && "text-destructive")}>
                {Number(iso.slice(8, 10))}
              </div>
              {ts.slice(0, 2).map((t) => (
                <div key={t.id} className="truncate text-foreground/80">• {t.title}</div>
              ))}
              {ps.slice(0, 1).map((p) => (
                <div key={p.id} className="truncate text-foreground/60">⚙ {p.name}</div>
              ))}
              {(ts.length + ps.length) > 3 && (
                <div className="text-muted-foreground">+{ts.length + ps.length - 3}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
