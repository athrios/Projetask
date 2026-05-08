import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface Props {
  date: string; // yyyy-mm-dd
  onChange: (date: string) => void;
  userId: string;
  /** Re-fetch trigger (e.g. tasks list version) */
  refreshKey?: number;
}

const toLocalISO = (d: Date) => {
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
};

export const TaskDatePicker = ({ date, onChange, userId, refreshKey }: Props) => {
  const [open, setOpen] = useState(false);
  const [pendingDays, setPendingDays] = useState<Date[]>([]);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("tasks")
      .select("task_date, status, done")
      .eq("user_id", userId)
      .neq("status", "feita")
      .then(({ data }) => {
        if (cancelled) return;
        const set = new Set<string>();
        (data ?? []).forEach((t: any) => {
          if (!t.done && t.task_date) set.add(t.task_date);
        });
        setPendingDays(
          Array.from(set).map((s) => {
            const [y, m, d] = s.split("-").map(Number);
            return new Date(y, m - 1, d);
          }),
        );
      });
    return () => {
      cancelled = true;
    };
  }, [userId, refreshKey, open]);

  const selected = (() => {
    const [y, m, d] = date.split("-").map(Number);
    return new Date(y, m - 1, d);
  })();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("h-9 justify-start font-normal gap-2 min-w-[180px]")}
        >
          <CalendarIcon className="h-4 w-4 opacity-70" />
          {format(selected, "PPP", { locale: ptBR })}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(d) => {
            if (d) {
              onChange(toLocalISO(d));
              setOpen(false);
            }
          }}
          locale={ptBR}
          initialFocus
          modifiers={{ pending: pendingDays }}
          modifiersClassNames={{
            pending:
              "relative after:content-[''] after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:h-1 after:w-1 after:rounded-full after:bg-primary",
          }}
          className={cn("p-3 pointer-events-auto")}
        />
        <div className="px-3 pb-3 pt-1 text-[11px] text-muted-foreground flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
          dias com tarefas pendentes
        </div>
      </PopoverContent>
    </Popover>
  );
};
