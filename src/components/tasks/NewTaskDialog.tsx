import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar as CalendarIcon, Plus, X, Pencil, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { PRIORITIES, type Priority, type TaskStatus } from "@/lib/taskTokens";
import { logActivity } from "@/lib/activityLog";
import { safeParse, taskTitleSchema, subtaskTitleSchema, notesSchema } from "@/lib/validation";

const INITIAL_STATUSES: { value: TaskStatus; label: string }[] = [
  { value: "pendente", label: "Pendente" },
  { value: "fazendo", label: "Fazendo" },
  { value: "aguardando", label: "Aguardando" },
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string;
  workspaceId: string | null;
  defaultDate: string; // ISO yyyy-mm-dd
  initialTitle?: string;
  positionHint?: number;
  onCreated?: (taskId: string) => void;
}

export const NewTaskDialog = ({
  open,
  onOpenChange,
  userId,
  workspaceId,
  defaultDate,
  initialTitle = "",
  positionHint = 0,
  onCreated,
}: Props) => {
  const [title, setTitle] = useState(initialTitle);
  const [priority, setPriority] = useState<Priority>("media");
  const [status, setStatus] = useState<TaskStatus>("pendente");
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [dueTime, setDueTime] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [subInput, setSubInput] = useState("");
  const [subtasks, setSubtasks] = useState<string[]>([]);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(initialTitle);
      setPriority("media");
      setStatus("pendente");
      setDueDate(null);
      setDueTime("");
      setNotes("");
      setSubInput("");
      setSubtasks([]);
      setEditIdx(null);
      setEditValue("");
    }
  }, [open, initialTitle]);

  const addSubtask = () => {
    const parsed = safeParse(subtaskTitleSchema, subInput);
    if (parsed.ok) {
      setSubtasks((arr) => [...arr, parsed.value]);
      setSubInput("");
    } else if (subInput.trim()) {
      toast.error(parsed.error);
    }
  };

  const removeSubtask = (i: number) => {
    setSubtasks((arr) => arr.filter((_, idx) => idx !== i));
    if (editIdx === i) setEditIdx(null);
  };

  const commitEdit = () => {
    if (editIdx === null) return;
    const parsed = safeParse(subtaskTitleSchema, editValue);
    if (!parsed.ok) {
      toast.error(parsed.error);
      return;
    }
    const value = parsed.value;
    setSubtasks((arr) => arr.map((s, i) => (i === editIdx ? value : s)));
    setEditIdx(null);
    setEditValue("");
  };

  const submit = async () => {
    if (!workspaceId) return toast.error("Selecione um ambiente de trabalho");
    const titleParsed = safeParse(taskTitleSchema, title);
    if (!titleParsed.ok) {
      toast.error(titleParsed.error);
      return;
    }
    const notesParsed = safeParse(notesSchema, notes);
    if (!notesParsed.ok) {
      toast.error(notesParsed.error);
      return;
    }
    if (dueTime && !/^\d{2}:\d{2}$/.test(dueTime)) {
      return toast.error("Horário inválido");
    }

    setSaving(true);
    const taskDate = dueDate ?? defaultDate;
    const { data: created, error } = await supabase
      .from("tasks")
      .insert({
        title: titleParsed.value,
        task_date: taskDate,
        due_date: dueDate,
        due_time: dueTime || null,
        priority,
        status,
        notes: notesParsed.value,
        user_id: userId,
        position: positionHint,
        workspace_id: workspaceId,
      } as never)
      .select()
      .single();

    if (error || !created) {
      setSaving(false);
      return toast.error(error?.message ?? "Erro ao criar tarefa");
    }

    const taskId = (created as { id: string }).id;

    if (subtasks.length > 0) {
      const rows = subtasks.map((s, idx) => ({
        task_id: taskId,
        title: s,
        user_id: userId,
        workspace_id: workspaceId,
        position: idx,
      }));
      const { error: subErr } = await supabase.from("subtasks").insert(rows as never);
      if (subErr) {
        // rollback to avoid orphan task with no subtasks
        await supabase.from("tasks").delete().eq("id", taskId);
        setSaving(false);
        return toast.error("Erro ao criar subtarefas: " + subErr.message);
      }
    }

    await logActivity(userId, "task", taskId, "created", `Tarefa criada: "${titleParsed.value}"`);
    toast.success("Tarefa criada");
    setSaving(false);
    onOpenChange(false);
    onCreated?.(taskId);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !saving && onOpenChange(v)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova tarefa</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="nt-title">Título</Label>
            <Input
              id="nt-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Digite o nome da tarefa"
              maxLength={200}
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Prioridade</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Status inicial</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INITIAL_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Prazo</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dueDate && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dueDate
                      ? format(new Date(dueDate + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR })
                      : "Selecionar data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dueDate ? new Date(dueDate + "T00:00:00") : undefined}
                    onSelect={(d) => setDueDate(d ? format(d, "yyyy-MM-dd") : null)}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                  {dueDate && (
                    <div className="p-2 border-t">
                      <Button variant="ghost" size="sm" className="w-full" onClick={() => setDueDate(null)}>
                        Limpar
                      </Button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="nt-time">Horário</Label>
              <Input
                id="nt-time"
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="nt-notes">Observações</Label>
            <Textarea
              id="nt-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Opcional"
              maxLength={5000}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Subtarefas</Label>
            <div className="flex items-center gap-2">
              <Input
                value={subInput}
                onChange={(e) => setSubInput(e.target.value)}
                placeholder="Digite uma subtarefa"
                maxLength={200}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addSubtask();
                  }
                }}
              />
              <Button type="button" variant="secondary" size="icon" onClick={addSubtask}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {subtasks.length > 0 && (
              <ul className="space-y-1 rounded-md border bg-card/50 p-2">
                {subtasks.map((s, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    {editIdx === i ? (
                      <>
                        <Input
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="h-7 text-sm"
                          maxLength={200}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") { e.preventDefault(); commitEdit(); }
                            if (e.key === "Escape") setEditIdx(null);
                          }}
                        />
                        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={commitEdit}>
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1 truncate">• {s}</span>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-muted-foreground"
                          onClick={() => { setEditIdx(i); setEditValue(s); }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => removeSubtask(i)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving || !title.trim()}>
            {saving ? "Criando..." : "Criar tarefa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
