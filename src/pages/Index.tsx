import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TasksPanel, type Task, type TasksFilter } from "@/components/TasksPanel";
import { SchedulePanel } from "@/components/SchedulePanel";
import { TodayPanel } from "@/components/TodayPanel";
import {
  LogOut,
  CalendarClock,
  ListChecks,
  Sun,
  CheckCircle2,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const today = () => new Date().toISOString().slice(0, 10);

type Section = "today" | "schedule" | "tasks" | "done" | "settings";

const SECTION_META: Record<
  Section,
  { label: string; icon: typeof Sun; subtitle: string }
> = {
  today: {
    label: "Hoje",
    icon: Sun,
    subtitle: "O que precisa acontecer hoje.",
  },
  schedule: {
    label: "Cronograma",
    icon: CalendarClock,
    subtitle: "Sua agenda do dia, bloco a bloco.",
  },
  tasks: {
    label: "Tarefas",
    icon: ListChecks,
    subtitle: "Tudo que você está cuidando.",
  },
  done: {
    label: "Concluídas",
    icon: CheckCircle2,
    subtitle: "O que você já tirou da frente.",
  },
  settings: {
    label: "Configurações",
    icon: Settings,
    subtitle: "Preferências do app.",
  },
};

const Index = () => {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [date, setDate] = useState(today());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [section, setSection] = useState<Section>("today");

  useEffect(() => {
    if (!loading && !user) nav("/auth", { replace: true });
  }, [user, loading, nav]);

  useEffect(() => {
    document.title = "Plano do dia · Tarefas e cronograma";
  }, []);

  // Always preload today's tasks for the schedule import picker
  useEffect(() => {
    if (!user) return;
    supabase
      .from("tasks")
      .select("*")
      .eq("task_date", date)
      .order("created_at", { ascending: true })
      .then(({ data }) => setTasks((data ?? []) as Task[]));
  }, [user, date, section]);

  if (loading || !user) return null;

  const meta = SECTION_META[section];
  const Icon = meta.icon;
  const order: Section[] = ["today", "schedule", "tasks", "done", "settings"];

  const tasksFilter: TasksFilter =
    section === "today" ? "today" : section === "done" ? "done" : "all";

  return (
    <main className="min-h-screen bg-background">
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside className="w-60 shrink-0 border-r bg-sidebar text-sidebar-foreground flex flex-col">
          <div className="px-4 py-4 border-b border-sidebar-border">
            <h1 className="text-sm font-semibold tracking-tight text-sidebar-primary">
              Plano do dia
            </h1>
            <p className="text-[11px] text-sidebar-foreground/70 truncate">
              {user.email}
            </p>
          </div>
          <nav className="flex-1 p-2 space-y-0.5">
            {order.map((id) => {
              const m = SECTION_META[id];
              const I = m.icon;
              const active = section === id;
              return (
                <button
                  key={id}
                  onClick={() => setSection(id)}
                  className={cn(
                    "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm transition",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60",
                  )}
                >
                  <I className="h-4 w-4" />
                  <span>{m.label}</span>
                </button>
              );
            })}
          </nav>
          <div className="p-2 border-t border-sidebar-border">
            <button
              onClick={() => supabase.auth.signOut()}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent/60"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </button>
          </div>
        </aside>

        {/* Main */}
        <div className="flex-1 min-w-0">
          <div className="max-w-5xl mx-auto px-8 py-8">
            <header className="mb-6 flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <Icon className="h-3.5 w-3.5" />
                  <span>{meta.label}</span>
                </div>
                <h2 className="text-2xl font-semibold tracking-tight">
                  {section === "today" ? "Hoje" : meta.label}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {meta.subtitle}
                </p>
              </div>
              {section !== "settings" && section !== "done" && section !== "today" && (
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-auto h-9"
                />
              )}
            </header>

            {section === "today" && (
              <TodayPanel date={today()} userId={user.id} />
            )}
            {section === "schedule" && (
              <SchedulePanel date={date} userId={user.id} tasks={tasks} />
            )}
            {(section === "tasks" || section === "done") && (
              <TasksPanel
                date={date}
                userId={user.id}
                filter={tasksFilter}
                onTasksChange={setTasks}
              />
            )}
            {section === "settings" && (
              <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
                Configurações em breve.
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
};

export default Index;
