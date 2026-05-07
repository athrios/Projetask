import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { TasksPanel, type Task } from "@/components/TasksPanel";
import { SchedulePanel } from "@/components/SchedulePanel";
import { LogOut, CalendarClock, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";

const today = () => new Date().toISOString().slice(0, 10);

type View = "schedule" | "tasks";

const Index = () => {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [date, setDate] = useState(today());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [view, setView] = useState<View>("schedule");

  useEffect(() => {
    if (!loading && !user) nav("/auth", { replace: true });
  }, [user, loading, nav]);

  useEffect(() => {
    document.title = "Plano do dia";
  }, []);

  if (loading || !user) return null;

  const tabs: { id: View; label: string; icon: typeof CalendarClock }[] = [
    { id: "schedule", label: "Cronograma", icon: CalendarClock },
    { id: "tasks", label: "Tarefas", icon: ListChecks },
  ];

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Plano do dia</h1>
            <p className="text-xs text-muted-foreground">{user.email}</p>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-auto"
            />
            <Button variant="ghost" size="icon" onClick={() => supabase.auth.signOut()} aria-label="Sair">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8 flex gap-4">
        <nav className="flex flex-col gap-1 shrink-0">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = view === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setView(t.id)}
                className={cn(
                  "flex flex-col items-center gap-1 w-20 py-3 rounded-md text-xs transition border",
                  active
                    ? "bg-primary text-primary-foreground border-transparent"
                    : "bg-card hover:bg-secondary text-muted-foreground border-border",
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="leading-none text-center">{t.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="flex-1 min-w-0">
          <Card className="p-6">
            {view === "schedule" ? (
              <SchedulePanel date={date} userId={user.id} tasks={tasks} />
            ) : (
              <TasksPanel date={date} userId={user.id} onTasksChange={setTasks} />
            )}
          </Card>
          {/* Keep tasks loaded in background for schedule's task picker */}
          {view === "schedule" && (
            <div className="hidden">
              <TasksPanel date={date} userId={user.id} onTasksChange={setTasks} />
            </div>
          )}
        </div>
      </div>
    </main>
  );
};

export default Index;
