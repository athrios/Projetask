import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { Bell, Check } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface NotificationRow {
  id: string;
  workspace_id: string;
  task_id: string | null;
  title: string;
  message: string;
  read_at: string | null;
  created_at: string;
}

interface Props {
  onOpenTask?: (taskId: string) => void;
}

const timeAgo = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60_000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins} min atrás`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} h atrás`;
  const days = Math.round(hrs / 24);
  return `${days} d atrás`;
};

export const NotificationsBell = ({ onOpenTask }: Props) => {
  const { user } = useAuth();
  const { workspaceId } = useWorkspace();
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [open, setOpen] = useState(false);

  const load = async () => {
    if (!user || !workspaceId) {
      setItems([]);
      return;
    }
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(20);
    setItems((data ?? []) as NotificationRow[]);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, workspaceId]);

  useEffect(() => {
    if (!user || !workspaceId) return;
    const ch = supabase
      .channel(`notif-${user.id}-${workspaceId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, workspaceId]);

  const unread = items.filter((n) => !n.read_at).length;

  const markAllRead = async () => {
    if (!user) return;
    const ids = items.filter((n) => !n.read_at).map((n) => n.id);
    if (!ids.length) return;
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() } as never)
      .in("id", ids);
    load();
  };

  const handleClick = async (n: NotificationRow) => {
    if (!n.read_at) {
      await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() } as never)
        .eq("id", n.id);
    }
    if (n.task_id && onOpenTask) {
      onOpenTask(n.task_id);
    }
    setOpen(false);
    load();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative p-2 rounded-md hover:bg-secondary/60 transition"
          aria-label="Notificações"
        >
          <Bell className="h-4 w-4 text-muted-foreground" />
          {unread > 0 && (
            <span className="absolute top-1 right-1 min-w-[16px] h-[16px] rounded-full bg-destructive text-destructive-foreground text-[10px] font-medium inline-flex items-center justify-center px-1 tabular-nums">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Notificações
          </span>
          {unread > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={markAllRead}>
              <Check className="h-3 w-3 mr-1" /> Marcar todas
            </Button>
          )}
        </div>
        <div className="max-h-[360px] overflow-y-auto">
          {items.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-8">
              Sem notificações.
            </p>
          )}
          {items.map((n) => (
            <button
              key={n.id}
              onClick={() => handleClick(n)}
              className={cn(
                "w-full text-left px-3 py-2.5 border-b last:border-b-0 hover:bg-secondary/60 transition",
                !n.read_at && "bg-secondary/30",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm leading-tight", !n.read_at && "font-medium")}>
                    {n.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                    {n.message}
                  </p>
                </div>
                {!n.read_at && (
                  <span className="mt-1 shrink-0 h-2 w-2 rounded-full bg-primary" />
                )}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">{timeAgo(n.created_at)}</p>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};
