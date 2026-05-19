import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Trash2, BellRing } from "lucide-react";
import { toast } from "sonner";
import { useWorkspace } from "@/hooks/useWorkspace";
import {
  REMINDER_PRESETS,
  describeReminder,
  computeReminderAt,
  type ReminderRow,
  type ReminderUnit,
} from "@/lib/reminders";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  taskId: string;
  userId: string;
  dueDate: string | null;
  dueTime: string | null;
  onDueTimeChange?: (time: string | null) => void;
}

interface DraftReminder {
  id?: string;
  offset_value: number;
  offset_unit: ReminderUnit;
  notify_in_app: boolean;
  notify_email: boolean;
}

const CUSTOM = "custom";

const presetKey = (v: number, u: ReminderUnit) =>
  REMINDER_PRESETS.findIndex((p) => p.offset_value === v && p.offset_unit === u);

export const TaskReminderEditor = ({
  open,
  onOpenChange,
  taskId,
  userId,
  dueDate,
  dueTime,
  onDueTimeChange,
}: Props) => {
  const { workspaceId } = useWorkspace();
  const [existing, setExisting] = useState<ReminderRow[]>([]);
  const [drafts, setDrafts] = useState<DraftReminder[]>([]);
  const [localTime, setLocalTime] = useState<string>(dueTime ?? "");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLocalTime(dueTime ?? "");
    (async () => {
      const { data } = await supabase
        .from("task_reminders")
        .select("*")
        .eq("task_id", taskId)
        .eq("status", "pending");
      const list = (data ?? []) as ReminderRow[];
      setExisting(list);
      setDrafts(
        list.map((r) => ({
          id: r.id,
          offset_value: r.offset_value,
          offset_unit: r.offset_unit,
          notify_in_app: r.notify_in_app,
          notify_email: r.notify_email,
        })),
      );
    })();
  }, [open, taskId, dueTime]);

  const addDraft = () => {
    setDrafts((p) => [
      ...p,
      { offset_value: 30, offset_unit: "minutes", notify_in_app: true, notify_email: false },
    ]);
  };

  const updateDraft = (i: number, patch: Partial<DraftReminder>) => {
    setDrafts((p) => p.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  };

  const removeDraft = (i: number) => {
    setDrafts((p) => p.filter((_, idx) => idx !== i));
  };

  const save = async () => {
    if (!dueDate) {
      toast.error("Defina um prazo para a tarefa antes de criar alertas.");
      return;
    }
    if (!workspaceId) return;
    setLoading(true);
    try {
      // 1. persist due_time on task
      const finalTime = localTime.trim() || null;
      if (finalTime !== (dueTime ?? null)) {
        await supabase.from("tasks").update({ due_time: finalTime } as never).eq("id", taskId);
        onDueTimeChange?.(finalTime);
      }

      // 2. delete existing reminders that were removed
      const keptIds = drafts.filter((d) => d.id).map((d) => d.id!);
      const toRemove = existing.filter((r) => !keptIds.includes(r.id)).map((r) => r.id);
      if (toRemove.length) {
        await supabase.from("task_reminders").delete().in("id", toRemove);
      }

      // 3. upsert remaining drafts
      for (const d of drafts) {
        if (!d.notify_in_app && !d.notify_email) continue;
        const reminder_at = computeReminderAt(
          dueDate,
          finalTime,
          d.offset_value,
          d.offset_unit,
        );
        if (d.id) {
          await supabase
            .from("task_reminders")
            .update({
              offset_value: d.offset_value,
              offset_unit: d.offset_unit,
              notify_in_app: d.notify_in_app,
              notify_email: d.notify_email,
              reminder_at,
              status: "pending",
            } as never)
            .eq("id", d.id);
        } else {
          await supabase.from("task_reminders").insert({
            task_id: taskId,
            user_id: userId,
            workspace_id: workspaceId,
            offset_value: d.offset_value,
            offset_unit: d.offset_unit,
            notify_in_app: d.notify_in_app,
            notify_email: d.notify_email,
            reminder_at,
          } as never);
        }
      }
      toast.success("Alertas salvos");
      onOpenChange(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BellRing className="h-4 w-4" /> Alertas da tarefa
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {!dueDate && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
              Esta tarefa não tem prazo. Adicione uma data antes de configurar alertas.
            </p>
          )}

          <div className="grid grid-cols-2 gap-2 items-end">
            <div>
              <label className="text-xs font-medium">Prazo</label>
              <Input value={dueDate ?? "—"} disabled className="h-8" />
            </div>
            <div>
              <label className="text-xs font-medium">Hora do prazo</label>
              <Input
                type="time"
                value={localTime}
                onChange={(e) => setLocalTime(e.target.value)}
                className="h-8"
              />
            </div>
          </div>

          <div className="space-y-2">
            {drafts.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Nenhum alerta configurado. Clique em "Adicionar alerta".
              </p>
            )}
            {drafts.map((d, i) => {
              const idx = presetKey(d.offset_value, d.offset_unit);
              const presetValue = idx >= 0 ? String(idx) : CUSTOM;
              return (
                <div key={i} className="rounded-md border p-3 space-y-2 bg-card">
                  <div className="flex items-center gap-2">
                    <Select
                      value={presetValue}
                      onValueChange={(v) => {
                        if (v === CUSTOM) {
                          updateDraft(i, { offset_value: 2, offset_unit: "days" });
                        } else {
                          const p = REMINDER_PRESETS[Number(v)];
                          updateDraft(i, { offset_value: p.offset_value, offset_unit: p.offset_unit });
                        }
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {REMINDER_PRESETS.map((p, k) => (
                          <SelectItem key={k} value={String(k)}>{p.label}</SelectItem>
                        ))}
                        <SelectItem value={CUSTOM}>Personalizado</SelectItem>
                      </SelectContent>
                    </Select>
                    <button
                      onClick={() => removeDraft(i)}
                      className="p-1.5 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {presetValue === CUSTOM && (
                    <div className="flex items-center gap-2 pl-1">
                      <Input
                        type="number"
                        min={0}
                        value={d.offset_value}
                        onChange={(e) =>
                          updateDraft(i, { offset_value: Math.max(0, Number(e.target.value) || 0) })
                        }
                        className="h-8 w-20"
                      />
                      <Select
                        value={d.offset_unit}
                        onValueChange={(v) => updateDraft(i, { offset_unit: v as ReminderUnit })}
                      >
                        <SelectTrigger className="h-8 w-32 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="minutes">minutos</SelectItem>
                          <SelectItem value="hours">horas</SelectItem>
                          <SelectItem value="days">dias</SelectItem>
                        </SelectContent>
                      </Select>
                      <span className="text-xs text-muted-foreground">antes</span>
                    </div>
                  )}

                  <div className="flex items-center gap-4 pl-1">
                    <label className="flex items-center gap-2 text-xs cursor-pointer">
                      <Checkbox
                        checked={d.notify_in_app}
                        onCheckedChange={(v) => updateDraft(i, { notify_in_app: !!v })}
                        className="h-3.5 w-3.5"
                      />
                      No sistema
                    </label>
                    <label className="flex items-center gap-2 text-xs cursor-pointer">
                      <Checkbox
                        checked={d.notify_email}
                        onCheckedChange={(v) => updateDraft(i, { notify_email: !!v })}
                        className="h-3.5 w-3.5"
                      />
                      E-mail
                    </label>
                    <span className="text-[11px] text-muted-foreground ml-auto">
                      {describeReminder(d)}
                    </span>
                  </div>
                </div>
              );
            })}

            <Button variant="outline" size="sm" onClick={addDraft} className="w-full h-8">
              <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar alerta
            </Button>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={save} disabled={loading}>
              Salvar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
