import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace, type ModuleKey } from "@/hooks/useWorkspace";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { TasksPanel, type Task, type TasksFilter } from "@/components/TasksPanel";
import { SchedulePanel } from "@/components/SchedulePanel";
import { TodayPanel } from "@/components/TodayPanel";
import { ProcessesPanel } from "@/components/processes/ProcessesPanel";
import { FormsPanel } from "@/components/forms/FormsPanel";
import { RequestsPanel } from "@/components/requests/RequestsPanel";
import { AgendaPanel } from "@/components/agenda/AgendaPanel";
import { ClientsPanel } from "@/components/clients/ClientsPanel";
import { GlobalSearch } from "@/components/shared/GlobalSearch";
import { WorkspaceSwitcher } from "@/components/workspace/WorkspaceSwitcher";
import { WorkspacesPanel } from "@/components/workspace/WorkspacesPanel";
import { SettingsPanel } from "@/components/settings/SettingsPanel";
import { RequireModule } from "@/components/auth/RequireModule";
import { NotificationsBell } from "@/components/notifications/NotificationsBell";
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
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const today = () => new Date().toISOString().slice(0, 10);

type Section =
  | "today"
  | "agenda"
  | "clients"
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
  today:     { label: "Hoje",          icon: Sun,           subtitle: "O que precisa acontecer hoje." },
  agenda:    { label: "Agenda",        icon: CalendarRange,  subtitle: "Visão de tarefas e processos por dia, semana e mês." },
  clients:   { label: "Clientes",      icon: Users,          subtitle: "Cadastro de clientes do ambiente." },
  schedule:  { label: "Cronograma",    icon: CalendarClock,  subtitle: "Sua agenda do dia, bloco a bloco." },
  tasks:     { label: "Tarefas",       icon: ListChecks,     subtitle: "Organize suas tarefas por data, status e prioridade." },
  processes: { label: "Processos",     icon: Workflow,       subtitle: "Processos recorrentes em execução." },
  forms:     { label: "Formulários",   icon: FileText,       subtitle: "Formulários para receber solicitações." },
  requests:  { label: "Respostas",     icon: Inbox,          subtitle: "Respostas recebidas dos formulários." },
  done:      { label: "Concluídas",    icon: CheckCircle2,   subtitle: "O que você já tirou da frente." },
  settings:  { label: "Configurações", icon: Settings,       subtitle: "Perfil, aparência e ambientes de trabalho." },
};

const SECTION_MODULE: Record<Exclude<Section, "settings">, ModuleKey> = {
  today:     "hoje",
  agenda:    "hoje",
  clients:   "clientes",
  schedule:  "cronograma",
  tasks:     "tarefas",
  processes: "processos",
  forms:     "formularios",
  requests:  "solicitacoes",
  done:      "concluidas",
};

const Index = () => {
  const { user, loading } = useAuth();
  const { workspaceId, canViewModule, isOwnerOfAny, loading: wsLoading } = useWorkspace();
  const nav = useNavigate();
  const isMobile = useIsMobile();

  const [date, setDate]             = useState(today());
  const [tasks, setTasks]           = useState<Task[]>([]);
  const [section, setSection]       = useState<Section>("today");
  const [searchOpen, setSearchOpen] = useState(false);

  // ── Sidebar: starts open on desktop, closed on mobile ────────
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth >= 768 : true
  );

  // ── Section transition (120 ms fade + lift) ───────────────────
  const [contentVisible, setContentVisible] = useState(true);
  const pendingSection = useRef<Section | null>(null);

  const changeSection = (id: Section) => {
    if (id === section) return;
    // Close sidebar overlay on mobile after selecting a section
    if (isMobile) setSidebarOpen(false);
    pendingSection.current = id;
    setContentVisible(false);
  };

  useEffect(() => {
    if (!contentVisible && pendingSection.current) {
      const t = setTimeout(() => {
        setSection(pendingSection.current!);
        pendingSection.current = null;
        setContentVisible(true);
      }, 80);
      return () => clearTimeout(t);
    }
  }, [contentVisible]);

  // ── Auth guard ────────────────────────────────────────────────
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
    "today", "agenda", "clients", "schedule", "tasks", "processes",
    "forms", "requests", "done", "settings",
  ];

  const visibleSections = allSections.filter((s) => {
    if (s === "settings") return true;
    return canViewModule(SECTION_MODULE[s]);
  });

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

  const expanded = sidebarOpen || isMobile;

  return (
    <main className="min-h-screen bg-background">
      <div className="flex min-h-screen">

        {/* ── MOBILE BACKDROP ─────────────────────────────────── */}
        {isMobile && sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/40"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* ── SIDEBAR ─────────────────────────────────────────── */}
        <aside
          className={cn(
            "flex flex-col border-r bg-sidebar text-sidebar-foreground overflow-hidden",
            // Mobile: fixed overlay that slides in/out
            "fixed inset-y-0 left-0 z-50",
            // Desktop: relative, part of the normal flow
            "md:relative md:inset-auto md:z-auto md:shrink-0",
            // Transitions
            "transition-[width,transform] duration-200 ease-in-out",
            isMobile
              ? cn("w-64", sidebarOpen ? "translate-x-0" : "-translate-x-full")
              : sidebarOpen ? "w-60" : "w-14",
          )}
        >
          {/* Header */}
          <div className="px-3 py-4 border-b border-sidebar-border relative flex items-center gap-2 min-h-[60px]">
            {/* Gold accent line */}
            <div className="absolute bottom-0 left-3 right-3 h-[1px] bg-gradient-to-r from-transparent via-[hsl(42,42%,50%)] to-transparent opacity-60" />

            {expanded && (
              <div className="flex flex-col flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <img
                    src="/ambitask-logo.png"
                    alt="Ambitask"
                    className="h-6 w-auto object-contain shrink-0"
                  />
                </div>
                <p className="text-[11px] text-sidebar-foreground/60 truncate pl-0.5">
                  {user.email}
                </p>
              </div>
            )}

            {/* Toggle button */}
            <button
              onClick={() => setSidebarOpen((o) => !o)}
              className={cn(
                "shrink-0 p-1 rounded-md text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/60 transition-colors",
                !sidebarOpen && !isMobile && "mx-auto",
              )}
              title={sidebarOpen ? "Ocultar menu" : "Mostrar menu"}
            >
              {expanded
                ? <PanelLeftClose className="h-4 w-4" />
                : <PanelLeftOpen  className="h-4 w-4" />
              }
            </button>
          </div>

          {/* Workspace switcher */}
          {expanded && (
            <WorkspaceSwitcher onManage={() => changeSection("settings")} />
          )}

          {/* Search bar */}
          {expanded && (
            <div className="px-2 pt-1">
              <button
                onClick={() => {
                  if (isMobile) setSidebarOpen(false);
                  setSearchOpen(true);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-sidebar-foreground/70 border border-sidebar-border hover:bg-sidebar-accent/60"
              >
                <Search className="h-3.5 w-3.5" />
                <span className="flex-1 text-left">Buscar...</span>
                <kbd className="hidden sm:inline text-[10px] px-1.5 py-0.5 rounded bg-sidebar-accent/60 border border-sidebar-border">⌘K</kbd>
              </button>
            </div>
          )}

          {/* Nav */}
          <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
            {visibleSections.map((id) => {
              const m = SECTION_META[id];
              const I = m.icon;
              const active = section === id;
              return (
                <button
                  key={id}
                  onClick={() => changeSection(id)}
                  title={!expanded ? m.label : undefined}
                  className={cn(
                    "w-full flex items-center rounded-md text-sm transition-colors duration-150",
                    expanded ? "gap-2 px-2.5 py-1.5" : "justify-center px-0 py-2",
                    active
                      ? cn(
                          "bg-sidebar-accent text-sidebar-accent-foreground font-medium",
                          expanded && "border-l-2 border-[hsl(42,42%,50%)] pl-[calc(0.625rem-2px)]",
                        )
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 border-l-2 border-transparent",
                    !expanded && active && "bg-sidebar-accent text-sidebar-accent-foreground border-l-0",
                  )}
                >
                  <I className={cn("shrink-0", expanded ? "h-4 w-4" : "h-5 w-5")} />
                  {expanded && <span>{m.label}</span>}
                </button>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="p-2 border-t border-sidebar-border">
            <button
              onClick={() => supabase.auth.signOut()}
              title={!expanded ? "Sair" : undefined}
              className={cn(
                "w-full flex items-center rounded-md text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent/60 transition-colors duration-150",
                expanded ? "gap-2 px-2.5 py-1.5" : "justify-center px-0 py-2",
              )}
            >
              <LogOut className={cn("shrink-0", expanded ? "h-4 w-4" : "h-5 w-5")} />
              {expanded && <span>Sair</span>}
            </button>
          </div>
        </aside>

        {/* ── MAIN CONTENT ────────────────────────────────────── */}
        <div className="flex-1 min-w-0">
          <div className="max-w-5xl mx-auto px-4 py-4 sm:px-6 sm:py-6 md:px-8 md:py-8">

            {/* Section header */}
            <header className="mb-4 sm:mb-6 flex items-start gap-3">

              {/* Hamburger — mobile only */}
              <button
                className="md:hidden shrink-0 mt-0.5 p-1.5 -ml-1 rounded-md text-muted-foreground hover:bg-muted/50 transition-colors"
                onClick={() => setSidebarOpen(true)}
                aria-label="Abrir menu"
              >
                <Menu className="h-5 w-5" />
              </button>

              {/* Title block */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <Icon className="h-3.5 w-3.5 text-[hsl(42,42%,50%)]" />
                  <span className="tracking-wide uppercase text-[10px] font-medium">{meta.label}</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground truncate">
                  {section === "today" ? "Hoje" : meta.label}
                </h2>
                <div className="hidden sm:flex items-center gap-2 mt-1">
                  <div className="w-8 h-[2px] rounded-full bg-[hsl(42,42%,50%)] opacity-70" />
                  <p className="text-sm text-muted-foreground">{meta.subtitle}</p>
                </div>
              </div>

              {/* Right actions */}
              <div className="flex items-center gap-2 shrink-0">
                {section === "schedule" && (
                  <Input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-auto h-9 text-sm"
                  />
                )}
                <NotificationsBell onOpenTask={() => changeSection("tasks")} />
              </div>
            </header>

            {/* ── Animated content area ── */}
            <div
              style={{
                transition: "opacity 120ms ease, transform 120ms ease",
                opacity:   contentVisible ? 1 : 0,
                transform: contentVisible ? "translateY(0)" : "translateY(6px)",
              }}
            >
              {section === "today" && (
                <RequireModule module="hoje" onDenied={() => changeSection("today")}>
                  <TodayPanel date={today()} userId={user.id} />
                </RequireModule>
              )}
              {section === "agenda" && (
                <RequireModule module="hoje" onDenied={() => changeSection("today")}>
                  <AgendaPanel userId={user.id} />
                </RequireModule>
              )}
              {section === "schedule" && (
                <RequireModule module="cronograma" onDenied={() => changeSection("today")}>
                  <SchedulePanel date={date} userId={user.id} tasks={tasks} />
                </RequireModule>
              )}
              {(section === "tasks" || section === "done") && (
                <RequireModule
                  module={section === "done" ? "concluidas" : "tarefas"}
                  onDenied={() => changeSection("today")}
                >
                  <TasksPanel
                    date={date}
                    userId={user.id}
                    filter={tasksFilter}
                    onTasksChange={setTasks}
                  />
                </RequireModule>
              )}
              {section === "processes" && (
                <RequireModule module="processos" onDenied={() => changeSection("today")}>
                  <ProcessesPanel userId={user.id} />
                </RequireModule>
              )}
              {section === "forms" && (
                <RequireModule module="formularios" onDenied={() => changeSection("today")}>
                  <FormsPanel userId={user.id} />
                </RequireModule>
              )}
              {section === "requests" && (
                <RequireModule module="solicitacoes" onDenied={() => changeSection("today")}>
                  <RequestsPanel userId={user.id} />
                </RequireModule>
              )}
              {section === "settings" && (
                <SettingsPanel />
              )}
            </div>
          </div>
        </div>
      </div>

      <GlobalSearch
        open={searchOpen}
        onOpenChange={setSearchOpen}
        onNavigate={(s) => changeSection(s)}
        workspaceId={workspaceId}
      />
    </main>
  );
};

export default Index;
