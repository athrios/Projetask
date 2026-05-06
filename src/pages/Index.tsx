import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { TasksPanel, type Task } from "@/components/TasksPanel";
import { SchedulePanel } from "@/components/SchedulePanel";
import { LogOut } from "lucide-react";

const today = () => new Date().toISOString().slice(0, 10);

const Index = () => {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [date, setDate] = useState(today());
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    if (!loading && !user) nav("/auth", { replace: true });
  }, [user, loading, nav]);

  useEffect(() => {
    document.title = "Plano do dia";
  }, []);

  if (loading || !user) return null;

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
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

      <div className="max-w-5xl mx-auto px-6 py-8 grid lg:grid-cols-2 gap-8">
        <Card className="p-6">
          <TasksPanel date={date} userId={user.id} onTasksChange={setTasks} />
        </Card>
        <Card className="p-6">
          <SchedulePanel date={date} userId={user.id} tasks={tasks} />
        </Card>
      </div>
    </main>
  );
};

export default Index;
