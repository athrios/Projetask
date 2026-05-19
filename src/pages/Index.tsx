import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace, type ModuleKey } from "@/hooks/useWorkspace";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { TasksPanel, type Task, type TasksFilter } from "@/components/TasksPanel";
import { SchedulePanel } from "@/components/SchedulePanel";
import { TodayPanel } from "@/components/TodayPanel";
import { ProcessesPanel } from "@/components/processes/ProcessesPanel";
import { FormsPanel } from "@/components/forms/FormsPanel";
import { RequestsPanel } from "@/components/requests/RequestsPanel";
import { AgendaPanel } from "@/components/agenda/AgendaPanel";
import { GlobalSearch } from "@/components/shared/GlobalSearch";
import { WorkspaceSwitcher } from "@/components/workspace/WorkspaceSwitcher";
import { WorkspacesPanel } from "@/components/workspace/WorkspacesPanel";
import { RequireModule, RequireOwner } from "@/components/auth/RequireModule";
import {
  LogOut,
  CalendarClock,
  ListChecks,
  Sun,
  CheckCircle2,
  Settings,
  Workflow,
  FileText,
  Inbox,
  CalendarRange,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";

const today = () => new Date().toISOString().slice(0, 10);

type Section =
  | "today"
  | "agenda"
  | "schedule"
  | "tasks"
  | "processes"
  | "forms"
  | "requests"
  | "done"
  | "settings";

const SECTION_META: Record<
  Section,
  { label: string; icon: typeof Sun; subtitle: string }
> = {
  today: { label: "Hoje", icon: Sun, subtitle: "O que precisa acontecer hoje." },
  agenda: { label: "Agenda", icon: CalendarRange, subtitle: "Visão de tarefas e processos por dia, semana e mês." },
  schedule: { label: "Cronograma", icon: CalendarClock, subtitle: "Sua agenda do dia, bloco a bloco." },
  tasks: { label: "Tarefas", icon: ListChecks, subtitle: "Organize suas tarefas por data, status e prioridade." },
  processes: { label: "Processos", icon: Workflow, subtitle: "Processos recorrentes em execução." },
  forms: { label: "Formulários", icon: FileText, subtitle: "Formulários para receber solicitações." },
  requests: { label: "Respostas", icon: Inbox, subtitle: "Respostas recebidas dos formulários." },
  done: { label: "Concluídas", icon: CheckCircle2, subtitle: "O que você já tirou da frente." },
  settings: { label: "Ambientes", icon: Settings, subtitle: "Gerencie ambientes, membros e permissões." },
};

const SECTION_MODULE: Record<Exclude<Section, "settings">, ModuleKey> = {
  today: "hoje",
  agenda: "hoje",
  schedule: "cronograma",
  tasks: "tarefas",
  processes: "processos",
  forms: "formularios",
  requests: "solicitacoes",
  done: "concluidas",
};

const Index = () => {
  const { user, loading } = useAuth();
  const { workspaceId, canViewModule, isOwnerOfAny, loading: wsLoading } = useWorkspace();
  const nav = useNavigate();
  const [date, setDate] = useState(today());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [section, setSection] = useState<Section>("today");
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) nav("/auth", { replace: true });
  }, [user, loading, nav]);

  useEffect(() => {
    document.title = "Plano do dia · Tarefas e cronograma";
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!user || !workspaceId) return;
    supabase
      .from("tasks")
      .select("*")
      .eq("task_date", date)
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: true })
      .then(({ data }) => setTasks((data ?? []) as Task[]));
  }, [user, date, section, workspaceId]);

  const allSections: Section[] = [
    "today", "agenda", "schedule", "tasks", "processes",
    "forms", "requests", "done", "settings",
  ];

  const visibleSections = allSections.filter((s) => {
    if (s === "settings") return isOwnerOfAny;
    return canViewModule(SECTION_MODULE[s]);
  });

  // Redirect away from sections the active workspace doesn't allow
  useEffect(() => {
    if (wsLoading) return;
    if (!visibleSections.includes(section)) {
      setSection(visibleSections[0] ?? "today");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, wsLoading]);

  if (loading || !user) return null;

  const meta = SECTION_META[section];
  const Icon = meta.icon;

  const tasksFilter: TasksFilter =
    section === "today" ? "today" : section === "done" ? "done" : "all";

  return (
    <main className="min-h-screen bg-background">
      <div className="flex min-h-screen">
        <aside className="w-60 shrink-0 border-r bg-sidebar text-sidebar-foreground flex flex-col">
          <div className="px-4 py-4 border-b border-sidebar-border">
            <h1 className="text-sm font-semibold tracking-tight text-sidebar-primary">
              Plano do dia
            </h1>
            <p className="text-[11px] text-sidebar-foreground/70 truncate">
              {user.email}
            </p>
          </div>

          <WorkspaceSwitcher onManage={() => setSection("settings")} />

          <div className="px-2 pt-1">
            <button
              onClick={() => setSearchOpen(true)}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-sidebar-foreground/70 border border-sidebar-border hover:bg-sidebar-accent/60"
            >
              <Search className="h-3.5 w-3.5" />
              <span className="flex-1 text-left">Buscar...</span>
              <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-sidebar-accent/60 border border-sidebar-border">⌘K</kbd>
            </button>
          </div>

          <nav className="flex-1 p-2 space-y-0.5">
            {visibleSections.map((id) => {
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
              {section === "schedule" && (
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
            {section === "agenda" && <AgendaPanel userId={user.id} />}
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
            {section === "processes" && <ProcessesPanel userId={user.id} />}
            {section === "forms" && <FormsPanel userId={user.id} />}
            {section === "requests" && <RequestsPanel userId={user.id} />}
            {section === "settings" && <WorkspacesPanel />}
          </div>
        </div>
      </div>

      <GlobalSearch
        open={searchOpen}
        onOpenChange={setSearchOpen}
        onNavigate={(s) => setSection(s)}
        workspaceId={workspaceId}
      />
    </main>
  );
};

export default Index;
