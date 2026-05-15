import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Settings2, Workflow, ChevronRight, Check, AlertCircle, Play, SkipForward, ChevronDown, CalendarIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { StatusPill } from "@/components/shared/StatusPill";
import { ViewSwitcher, type ViewMode } from "@/components/shared/ViewSwitcher";
import { EmptyState } from "@/components/shared/EmptyState";
import { PROCESS_STATUS, type ProcessStatus } from "@/lib/taskTokens";
import { logActivity } from "@/lib/activityLog";
import { addDaysISO } from "@/lib/recurrence";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  TEMPLATE_COLORS,
  asColor,
  colorPill,
  colorLeftBorder,
  type TemplateColor,
} from "./templateColors";

interface Template {
  id: string;
  name: string;
  description: string;
  color?: string;
  steps?: TmplStep[];
}
interface TmplStep {
  id: string;
  template_id: string;
  position: number;
  title: string;
  due_offset_days?: number;
}
interface Process {
  id: string;
  template_id: string | null;
  name: string;
  client_name: string;
  status: ProcessStatus;
  due_date: string | null;
  notes: string;
  created_at?: string;
}
interface Step {
  id: string;
  process_id: string;
  position: number;
  title: string;
  status: "pendente" | "fazendo" | "feita" | "pulado";
  notes: string;
  due_date?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  dismissed_at?: string | null;
}

interface Props {
  userId: string;
}

export const ProcessesPanel = ({ userId }: Props) => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [processes, setProcesses] = useState<Process[]>([]);
  const [stepsByProc, setStepsByProc] = useState<Record<string, Step[]>>({});
  const [view, setView] = useState<ViewMode>("cards");
  const [openProc, setOpenProc] = useState<Process | null>(null);

  const load = async () => {
    const [t, p] = await Promise.all([
      supabase.from("process_templates").select("*").order("created_at", { ascending: true }),
      supabase.from("processes").select("*").order("created_at", { ascending: false }),
    ]);
    if (t.error) return toast.error(t.error.message);
    if (p.error) return toast.error(p.error.message);
    setTemplates((t.data ?? []) as Template[]);
    const procs = (p.data ?? []) as Process[];
    let grouped: Record<string, Step[]> = {};
    if (procs.length) {
      const { data: s } = await supabase
        .from("process_steps")
        .select("*")
        .in("process_id", procs.map((x) => x.id))
        .order("position", { ascending: true });
      (s ?? []).forEach((row) => {
        (grouped[row.process_id] ||= []).push(row as unknown as Step);
      });
      setStepsByProc(grouped);
    } else setStepsByProc({});

    const normalized = procs.map((proc) => ({
      ...proc,
      status: computeProcessStatus(proc.status, grouped[proc.id] ?? []),
    }));
    setProcesses(normalized);
    if (openProc) {
      const updatedOpen = normalized.find((proc) => proc.id === openProc.id);
      if (updatedOpen) setOpenProc(updatedOpen);
    }

    await Promise.all(
      normalized
        .filter((proc, index) => proc.status !== procs[index].status)
        .map((proc) => supabase.from("processes").update({ status: proc.status }).eq("id", proc.id)),
    );
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createProcess = async (templateId: string | null, name: string, dueDate: string | null) => {
    const tpl = templates.find((t) => t.id === templateId);
    const { data: proc, error } = await supabase
      .from("processes")
      .insert({
        user_id: userId,
        name,
        template_id: templateId,
        status: "nao_iniciado",
        due_date: dueDate,
      })
      .select()
      .single();
    if (error || !proc) return toast.error(error?.message ?? "Erro");

    if (templateId) {
      const { data: tmplSteps, error: stepsError } = await supabase
        .from("process_template_steps")
        .select("*")
        .eq("template_id", templateId)
        .order("position", { ascending: true });
      if (stepsError) return toast.error(stepsError.message);
      const baseISO = (dueDate ?? proc.created_at?.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
      const rows = (tmplSteps ?? []).map((s, i) => {
        const offset = (s as { due_offset_days?: number }).due_offset_days ?? 0;
        return {
          process_id: proc.id,
          user_id: userId,
          position: i,
          title: s.title,
          status: "pendente" as const,
          due_date: offset > 0 ? addDaysISO(baseISO, offset) : null,
        };
      });
      if (rows.length) {
        const { error: insertStepsError } = await supabase.from("process_steps").insert(rows as never);
        if (insertStepsError) return toast.error(insertStepsError.message);
      }
    }
    await logActivity(userId, "process", proc.id, "created", `Processo criado: "${name}"`);
    toast.success(tpl ? `Processo criado a partir de ${tpl.name}` : "Processo criado");
    load();
  };

  const removeProcess = async (id: string) => {
    if (!confirm("Excluir processo e todas as etapas?")) return;
    const proc = processes.find((p) => p.id === id);
    const { error } = await supabase.from("processes").delete().eq("id", id);
    if (error) return toast.error(error.message);
    await logActivity(userId, "process", id, "deleted", `Processo excluído: "${proc?.name ?? ""}"`);
    toast.success("Processo excluído");
    load();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <ViewSwitcher value={view} onChange={setView} views={["cards", "list", "kanban"]} />
        <div className="flex items-center gap-2">
          <TemplateManager userId={userId} templates={templates} reload={load} />
          <NewProcessButton templates={templates} onCreate={createProcess} />
        </div>
      </div>

      {processes.length === 0 ? (
        <EmptyState
          icon={Workflow}
          title="Nenhum processo ainda"
          description="Crie um modelo com etapas e depois inicie processos a partir dele."
        />
      ) : view === "kanban" ? (
        <KanbanView
          processes={processes}
          stepsByProc={stepsByProc}
          templates={templates}
          onOpen={setOpenProc}
        />
      ) : view === "list" ? (
        <ListView
          processes={processes}
          stepsByProc={stepsByProc}
          onOpen={setOpenProc}
          onRemove={removeProcess}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {processes.map((p) => {
            const tpl = templates.find((t) => t.id === p.template_id);
            return (
              <ProcessCard
                key={p.id}
                p={p}
                steps={stepsByProc[p.id] ?? []}
                templateName={tpl?.name ?? null}
                templateColor={asColor(tpl?.color)}
                onOpen={() => setOpenProc(p)}
              />
            );
          })}
        </div>
      )}

      {openProc && (
        <ProcessDetail
          process={openProc}
          steps={stepsByProc[openProc.id] ?? []}
          userId={userId}
          onClose={() => setOpenProc(null)}
          onChanged={() => {
            load();
          }}
        />
      )}
    </div>
  );
};

/* ───────── Date picker (popover) ───────── */

const toLocalISO = (d: Date) => {
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
};

const DateField = ({
  value,
  onChange,
  placeholder = "Selecionar data",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) => {
  const [open, setOpen] = useState(false);
  const selected = value
    ? (() => {
        const [y, m, d] = value.split("-").map(Number);
        return new Date(y, m - 1, d);
      })()
    : undefined;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "w-full justify-start font-normal gap-2 h-9",
            !selected && "text-muted-foreground",
          )}
        >
          <CalendarIcon className="h-4 w-4 opacity-70 shrink-0" />
          <span className="truncate">
            {selected ? format(selected, "PPP", { locale: ptBR }) : placeholder}
          </span>
          {value && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
              }}
              className="ml-auto text-xs text-muted-foreground hover:text-foreground"
            >
              limpar
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0 max-w-[calc(100vw-2rem)]"
        align="start"
        collisionPadding={12}
      >
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
          className="p-3 pointer-events-auto"
        />
      </PopoverContent>
    </Popover>
  );
};


/* ───────── Sub-components ───────── */

const ProcessCard = ({
  p,
  steps,
  templateName,
  templateColor = "gray",
  onOpen,
}: {
  p: Process;
  steps: Step[];
  templateName?: string | null;
  templateColor?: TemplateColor;
  onOpen: () => void;
}) => {
  const done = steps.filter((s) => s.status === "feita" || s.status === "pulado").length;
  const total = steps.length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const current = steps.find((s) => s.status === "fazendo") ?? steps.find((s) => s.status === "pendente");
  const currentNote = current?.notes?.trim() ?? "";
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className={cn(
        "rounded-xl border bg-card p-4 hover:shadow-sm transition group cursor-pointer text-left border-l-4",
        colorLeftBorder[templateColor],
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0 space-y-1.5">
          <span
            className={cn(
              "inline-flex items-center max-w-full truncate rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
              colorPill[templateColor],
            )}
          >
            {templateName ?? "Processo avulso"}
          </span>
          <h4 className="text-sm font-semibold truncate">{p.name}</h4>
          {p.client_name && (
            <p className="text-xs text-muted-foreground truncate">{p.client_name}</p>
          )}
        </div>
        <StatusPill domain="process" value={p.status} size="xs" />
      </div>
      <div className="mt-3 space-y-2">
        <div className="flex items-center gap-2">
          <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-foreground/70" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {done}/{total}
          </span>
        </div>
        {current && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ChevronRight className="h-3 w-3" />
            <span className="shrink-0">Etapa atual:</span>
            <span className="truncate">{current.title}</span>
          </div>
        )}
        {currentNote && (
          <div className="rounded-md bg-muted/40 px-2 py-1.5">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Observação</p>
            <p className="text-xs text-foreground/80 line-clamp-2 break-words">{currentNote}</p>
          </div>
        )}
        {p.due_date && (
          <p className="text-[11px] text-muted-foreground">Prazo: {p.due_date}</p>
        )}
      </div>
    </div>
  );
};

const ListView = ({
  processes,
  stepsByProc,
  onOpen,
  onRemove,
}: {
  processes: Process[];
  stepsByProc: Record<string, Step[]>;
  onOpen: (p: Process) => void;
  onRemove: (id: string) => void;
}) => (
  <div className="rounded-xl border bg-card divide-y">
    {processes.map((p) => {
      const steps = stepsByProc[p.id] ?? [];
      const done = steps.filter((s) => s.status === "feita" || s.status === "pulado").length;
      const current = steps.find((s) => s.status === "fazendo") ?? steps.find((s) => s.status === "pendente");
      return (
        <div key={p.id} className="px-4 py-3 flex items-center gap-3 group hover:bg-muted/30">
          <button onClick={() => onOpen(p)} className="flex-1 min-w-0 text-left">
            <p className="text-sm font-medium truncate">{p.name}</p>
            <p className="text-xs text-muted-foreground truncate">
              {p.client_name || "—"} · {done}/{steps.length} etapas{current ? ` · ${current.title}` : ""}
            </p>
          </button>
          <StatusPill domain="process" value={p.status} size="xs" />
          <button
            onClick={() => onRemove(p.id)}
            className="p-1.5 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      );
    })}
  </div>
);

const KanbanView = ({
  processes,
  stepsByProc,
  templates,
  onOpen,
}: {
  processes: Process[];
  stepsByProc: Record<string, Step[]>;
  templates: Template[];
  onOpen: (p: Process) => void;
}) => (
  <div className="overflow-x-auto -mx-2 pb-2">
    <div className="flex gap-3 px-2 min-w-max">
      {PROCESS_STATUS.map((col) => {
        const items = processes.filter((p) => p.status === col.value);
        return (
          <div key={col.value} className="w-72 shrink-0">
            <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center justify-between px-1">
              <span>{col.label}</span>
              <span className="tabular-nums">{items.length}</span>
            </div>
            <div className="space-y-2">
              {items.map((p) => {
                const tpl = templates.find((t) => t.id === p.template_id);
                return (
                  <ProcessCard
                    key={p.id}
                    p={p}
                    steps={stepsByProc[p.id] ?? []}
                    templateName={tpl?.name ?? null}
                    templateColor={asColor(tpl?.color)}
                    onOpen={() => onOpen(p)}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

const NewProcessButton = ({
  templates,
  onCreate,
}: {
  templates: Template[];
  onCreate: (templateId: string | null, name: string, dueDate: string | null) => void;
}) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [tpl, setTpl] = useState<string>("none");
  const [due, setDue] = useState<string>("");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4" /> Novo processo
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo processo</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium">Nome</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Alteração contratual - ACME" />
          </div>
          <div>
            <label className="text-xs font-medium">Modelo</label>
            <Select value={tpl} onValueChange={setTpl}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem modelo</SelectItem>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium">Data inicial / prazo (opcional)</label>
            <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
            <p className="text-[11px] text-muted-foreground mt-1">
              Usada para calcular automaticamente os prazos das etapas do modelo.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button
            onClick={() => {
              if (!name.trim()) return toast.error("Nome obrigatório");
              onCreate(tpl === "none" ? null : tpl, name.trim(), due || null);
              setOpen(false); setName(""); setTpl("none"); setDue("");
            }}
          >Criar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const TemplateManager = ({
  userId,
  templates,
  reload,
}: {
  userId: string;
  templates: Template[];
  reload: () => void;
}) => {
  const [open, setOpen] = useState(false);
  const [stepsByTpl, setStepsByTpl] = useState<Record<string, TmplStep[]>>({});
  const [newTplName, setNewTplName] = useState("");
  const [stepInput, setStepInput] = useState<Record<string, string>>({});

  const loadSteps = async () => {
    if (!templates.length) return;
    const { data } = await supabase
      .from("process_template_steps")
      .select("*")
      .order("position", { ascending: true });
    const grouped: Record<string, TmplStep[]> = {};
    (data ?? []).forEach((s) => {
      (grouped[s.template_id] ||= []).push(s as TmplStep);
    });
    setStepsByTpl(grouped);
  };

  useEffect(() => {
    if (open) loadSteps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, templates.length]);

  const addTpl = async () => {
    const n = newTplName.trim();
    if (!n) return;
    const { error } = await supabase.from("process_templates").insert({ name: n, user_id: userId });
    if (error) return toast.error(error.message);
    toast.success("Modelo criado");
    setNewTplName("");
    reload();
  };
  const removeTpl = async (id: string) => {
    if (!confirm("Excluir modelo e suas etapas?")) return;
    const { error } = await supabase.from("process_templates").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Modelo excluído");
    reload();
  };
  const addStep = async (tplId: string) => {
    const t = (stepInput[tplId] ?? "").trim();
    if (!t) return;
    const pos = (stepsByTpl[tplId] ?? []).length;
    await supabase.from("process_template_steps").insert({
      template_id: tplId, user_id: userId, title: t, position: pos,
    });
    setStepInput((p) => ({ ...p, [tplId]: "" }));
    loadSteps();
  };
  const removeStep = async (id: string) => {
    await supabase.from("process_template_steps").delete().eq("id", id);
    loadSteps();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Settings2 className="h-4 w-4" /> Modelos
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modelos de processo</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <form
            className="flex gap-2"
            onSubmit={(e) => { e.preventDefault(); addTpl(); }}
          >
            <Input
              value={newTplName}
              onChange={(e) => setNewTplName(e.target.value)}
              placeholder="Novo modelo (ex.: Alteração Contratual)"
            />
            <Button type="submit" size="sm">Adicionar</Button>
          </form>
          <div className="space-y-3">
            {templates.map((t) => {
              const steps = stepsByTpl[t.id] ?? [];
              return (
                <div key={t.id} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold">{t.name}</h4>
                    <button onClick={() => removeTpl(t.id)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <ol className="space-y-1 text-sm">
                    {steps.map((s, i) => (
                      <li key={s.id} className="flex items-center gap-2 group">
                        <span className="text-xs text-muted-foreground w-5">{i + 1}.</span>
                        <span className="flex-1 truncate">{s.title}</span>
                        <Input
                          type="number"
                          min={0}
                          defaultValue={s.due_offset_days ?? 0}
                          onBlur={async (e) => {
                            const v = Math.max(0, Number(e.target.value) || 0);
                            await supabase.from("process_template_steps")
                              .update({ due_offset_days: v } as never).eq("id", s.id);
                            loadSteps();
                          }}
                          className="h-7 w-20 text-xs"
                          title="Prazo em dias após o início do processo"
                        />
                        <span className="text-[11px] text-muted-foreground">dias</span>
                        <button
                          onClick={() => removeStep(s.id)}
                          className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </li>
                    ))}
                  </ol>
                  <form
                    className="flex gap-2"
                    onSubmit={(e) => { e.preventDefault(); addStep(t.id); }}
                  >
                    <Input
                      value={stepInput[t.id] ?? ""}
                      onChange={(e) => setStepInput((p) => ({ ...p, [t.id]: e.target.value }))}
                      placeholder="Adicionar etapa…"
                      className="h-8 text-sm"
                    />
                    <Button type="submit" size="sm" variant="outline">
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </form>
                </div>
              );
            })}
            {templates.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-6">Nenhum modelo ainda.</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

/* ───────── Process detail (operational timeline) ───────── */

type StepStatus = Step["status"];

const stepStatusLabel: Record<StepStatus, string> = {
  pendente: "Pendente",
  fazendo: "Em andamento",
  feita: "Concluída",
  pulado: "Dispensada",
};

function computeProcessStatus(current: ProcessStatus, steps: Step[]): ProcessStatus {
  if (current === "cancelado") return "cancelado";
  if (steps.length === 0) return "nao_iniciado";
  const allResolved = steps.every((s) => s.status === "feita" || s.status === "pulado");
  if (allResolved) return "concluido";
  const anyStarted = steps.some((s) => s.status !== "pendente");
  return anyStarted ? "em_andamento" : "nao_iniciado";
}

const ProcessDetail = ({
  process,
  steps,
  userId,
  onClose,
  onChanged,
}: {
  process: Process;
  steps: Step[];
  userId: string;
  onClose: () => void;
  onChanged: () => void;
}) => {
  const [name, setName] = useState(process.name);
  const [client, setClient] = useState(process.client_name);
  const [due, setDue] = useState(process.due_date ?? "");
  const [notes, setNotes] = useState(process.notes);
  const [showFuture, setShowFuture] = useState(false);
  const [stepInput, setStepInput] = useState("");
  const [obsDraft, setObsDraft] = useState<Record<string, string>>({});

  const resolved = steps.filter((s) => s.status === "feita" || s.status === "pulado");
  const active = steps.find((s) => s.status === "fazendo");
  const firstPending = steps.find((s) => s.status === "pendente");
  const currentStep = active ?? firstPending ?? null;
  const futureSteps = steps.filter(
    (s) => s.status === "pendente" && s.id !== currentStep?.id,
  );
  const total = steps.length;
  const doneCount = resolved.length;
  const pct = total ? Math.round((doneCount / total) * 100) : 0;

  const autoStatus = computeProcessStatus(process.status, steps);

  const saveDetails = async () => {
    const { error } = await supabase.from("processes").update({
      name, client_name: client, due_date: due || null, notes,
    }).eq("id", process.id);
    if (error) return toast.error(error.message);
    toast.success("Processo atualizado");
    onChanged();
  };

  const persistProcessStatus = async (after: Step[]) => {
    const next = computeProcessStatus(process.status === "cancelado" ? "cancelado" : autoStatus, after);
    const { error } = await supabase.from("processes").update({ status: next }).eq("id", process.id);
    if (error) {
      toast.error(error.message);
      return false;
    }
    if (next === "concluido") {
      await logActivity(userId, "process", process.id, "completed", `Processo concluído: "${process.name}"`);
      toast.success("Processo concluído");
    }
    return true;
  };

  const startProcess = async () => {
    const first = [...steps].sort((a, b) => a.position - b.position).find((s) => s.status === "pendente");
    if (!first) return;
    const { error } = await supabase.from("process_steps").update({
      status: "fazendo", started_at: new Date().toISOString(),
    }).eq("id", first.id);
    if (error) return toast.error(error.message);
    const after = steps.map((s) => (s.id === first.id ? { ...s, status: "fazendo" as const, started_at: new Date().toISOString() } : s));
    const ok = await persistProcessStatus(after);
    if (!ok) return;
    toast.success("Processo iniciado");
    onChanged();
  };

  const advanceNext = async (afterSteps: Step[]) => {
    const nextPending = [...afterSteps].sort((a, b) => a.position - b.position).find((s) => s.status === "pendente");
    if (nextPending) {
      const { error } = await supabase.from("process_steps").update({
        status: "fazendo", started_at: new Date().toISOString(),
      }).eq("id", nextPending.id);
      if (error) {
        toast.error(error.message);
        return null;
      }
      return afterSteps.map((s) => (s.id === nextPending.id ? { ...s, status: "fazendo" as const } : s));
    }
    return afterSteps;
  };

  const completeStep = async (s: Step) => {
    const notesValue = obsDraft[s.id] ?? s.notes ?? "";
    const completedAt = new Date().toISOString();
    const { error } = await supabase.from("process_steps").update({
      status: "feita", completed_at: completedAt, notes: notesValue,
    }).eq("id", s.id);
    if (error) return toast.error(error.message);
    let after = steps.map((x) => (x.id === s.id ? { ...x, status: "feita" as const, completed_at: completedAt, notes: notesValue } : x));
    after = await advanceNext(after);
    if (!after) return;
    const ok = await persistProcessStatus(after);
    if (!ok) return;
    toast.success("Etapa concluída");
    onChanged();
  };

  const dismissStep = async (s: Step) => {
    const notesValue = obsDraft[s.id] ?? s.notes ?? "";
    const dismissedAt = new Date().toISOString();
    const { error } = await supabase.from("process_steps").update({
      status: "pulado", dismissed_at: dismissedAt, notes: notesValue,
    }).eq("id", s.id);
    if (error) return toast.error(error.message);
    let after = steps.map((x) => (x.id === s.id ? { ...x, status: "pulado" as const, dismissed_at: dismissedAt, notes: notesValue } : x));
    after = await advanceNext(after);
    if (!after) return;
    const ok = await persistProcessStatus(after);
    if (!ok) return;
    toast.success("Etapa dispensada");
    onChanged();
  };

  const saveObservation = async (s: Step) => {
    const v = obsDraft[s.id] ?? s.notes ?? "";
    await supabase.from("process_steps").update({ notes: v }).eq("id", s.id);
    toast.success("Observação salva");
    onChanged();
  };

  const addStep = async () => {
    const t = stepInput.trim();
    if (!t) return;
    await supabase.from("process_steps").insert({
      process_id: process.id, user_id: userId, title: t, position: steps.length, status: "pendente",
    });
    setStepInput("");
    onChanged();
  };

  const removeStep = async (id: string) => {
    if (!confirm("Excluir esta etapa?")) return;
    await supabase.from("process_steps").delete().eq("id", id);
    onChanged();
  };

  const cancelProcess = async () => {
    if (!confirm("Cancelar este processo?")) return;
    await supabase.from("processes").update({ status: "cancelado" }).eq("id", process.id);
    await logActivity(userId, "process", process.id, "status_changed", `Processo cancelado: "${process.name}"`);
    toast.success("Processo cancelado");
    onChanged();
  };

  const canStart = autoStatus === "nao_iniciado" && total > 0 && process.status !== "cancelado";
  const isCancelled = process.status === "cancelado";

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">{process.name}</DialogTitle>
          {process.client_name && (
            <p className="text-xs text-muted-foreground">{process.client_name}</p>
          )}
        </DialogHeader>

        {/* Header summary */}
        <div className="space-y-3 -mt-1">
          <div className="flex items-center gap-3 flex-wrap">
            <StatusPill domain="process" value={autoStatus} size="sm" />
            <span className="text-xs text-muted-foreground tabular-nums">
              {doneCount}/{total} etapas
            </span>
            <div className="h-1.5 flex-1 min-w-[120px] rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-foreground/70 transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {canStart && (
              <Button size="sm" onClick={startProcess}>
                <Play className="h-3.5 w-3.5" /> Iniciar processo
              </Button>
            )}
            {!isCancelled && autoStatus !== "concluido" && (
              <Button size="sm" variant="outline" onClick={cancelProcess}>
                Cancelar processo
              </Button>
            )}
            {isCancelled && <span className="text-xs text-muted-foreground">Processo cancelado manualmente.</span>}
          </div>
        </div>

        {/* Timeline */}
        <div className="mt-4 space-y-2">
          {/* Resolved (compact) */}
          {resolved.map((s) => (
            <ResolvedStepRow
              key={s.id}
              s={s}
              index={steps.findIndex((x) => x.id === s.id)}
              draft={obsDraft[s.id] ?? s.notes ?? ""}
              onDraftChange={(v) => setObsDraft((p) => ({ ...p, [s.id]: v }))}
              onSaveObservation={() => saveObservation(s)}
            />
          ))}

          {/* Current (expanded) */}
          {currentStep && (
            <CurrentStepCard
              s={currentStep}
              index={steps.findIndex((x) => x.id === currentStep.id)}
              draft={obsDraft[currentStep.id] ?? currentStep.notes ?? ""}
              onDraftChange={(v) => setObsDraft((p) => ({ ...p, [currentStep.id]: v }))}
              onSaveObservation={() => saveObservation(currentStep)}
              onComplete={() => completeStep(currentStep)}
              onDismiss={() => dismissStep(currentStep)}
              onRemove={() => removeStep(currentStep.id)}
              disabled={isCancelled || currentStep.status === "pendente"}
              showStartHint={currentStep.status === "pendente"}
            />
          )}

          {/* Future (collapsed) */}
          {futureSteps.length > 0 && (
            <div>
              <button
                onClick={() => setShowFuture((v) => !v)}
                className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 px-2 py-1"
              >
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showFuture && "rotate-180")} />
                {showFuture ? "Ocultar próximas etapas" : `Exibir próximas etapas (${futureSteps.length})`}
              </button>
              {showFuture && (
                <ul className="mt-1 space-y-1">
                  {futureSteps.map((s) => (
                    <li
                      key={s.id}
                      className="flex items-center gap-2 px-3 py-2 rounded-md border border-dashed text-xs text-muted-foreground group"
                    >
                      <span className="w-5 tabular-nums">{steps.findIndex((x) => x.id === s.id) + 1}.</span>
                      <span className="flex-1 truncate">{s.title}</span>
                      {s.due_date && <span className="tabular-nums">{s.due_date}</span>}
                      <StatusPill domain="process_step" value={s.status} size="xs" />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Add step */}
          <form
            className="flex gap-2 pt-2"
            onSubmit={(e) => { e.preventDefault(); addStep(); }}
          >
            <Input
              value={stepInput}
              onChange={(e) => setStepInput(e.target.value)}
              placeholder="Nova etapa…"
              className="h-8 text-sm"
            />
            <Button type="submit" size="sm" variant="outline">
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </form>
        </div>

        {/* Details (editable) */}
        <details className="mt-4 group">
          <summary className="text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground">
            Editar detalhes do processo
          </summary>
          <div className="mt-3 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium">Nome</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium">Cliente</label>
                <Input value={client} onChange={(e) => setClient(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium">Prazo</label>
                <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium">Observações gerais</label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-[70px]" />
            </div>
            <Button size="sm" onClick={saveDetails}>Salvar detalhes</Button>
          </div>
        </details>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const ResolvedStepRow = ({
  s, index, draft, onDraftChange, onSaveObservation,
}: {
  s: Step;
  index: number;
  draft: string;
  onDraftChange: (v: string) => void;
  onSaveObservation: () => void;
}) => {
  const isDismissed = s.status === "pulado";
  return (
    <div
      className={cn(
        "flex items-start gap-2 px-3 py-2 rounded-md border group",
        isDismissed ? "bg-muted/30 border-dashed" : "bg-muted/20",
      )}
    >
      <div
        className={cn(
          "h-5 w-5 rounded-full flex items-center justify-center shrink-0 mt-0.5",
          isDismissed ? "bg-muted text-muted-foreground" : "bg-foreground text-background",
        )}
      >
        {isDismissed ? <SkipForward className="h-3 w-3" /> : <Check className="h-3 w-3" />}
      </div>
      <span className="text-xs text-muted-foreground tabular-nums mt-0.5">{index + 1}.</span>
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "text-sm truncate",
            isDismissed ? "text-muted-foreground italic" : "text-muted-foreground line-through",
          )}
        >
          {s.title}
        </p>
        {s.notes && (
          <p className="text-[11px] text-muted-foreground mt-0.5 whitespace-pre-wrap">{s.notes}</p>
        )}
        <details className="mt-1">
          <summary className="text-[11px] text-muted-foreground cursor-pointer hover:text-foreground">
            Editar observação
          </summary>
          <div className="mt-2 space-y-1">
            <Textarea
              value={draft}
              onChange={(e) => onDraftChange(e.target.value)}
              className="min-h-[56px] text-xs"
              placeholder="Observação desta etapa…"
            />
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={onSaveObservation}>
              Salvar observação
            </Button>
          </div>
        </details>
      </div>
      <StatusPill domain="process_step" value={s.status} size="xs" />
    </div>
  );
};

const CurrentStepCard = ({
  s, index, draft, onDraftChange, onSaveObservation, onComplete, onDismiss, onRemove, disabled, showStartHint,
}: {
  s: Step;
  index: number;
  draft: string;
  onDraftChange: (v: string) => void;
  onSaveObservation: () => void;
  onComplete: () => void;
  onDismiss: () => void;
  onRemove: () => void;
  disabled: boolean;
  showStartHint: boolean;
}) => {
  const today = new Date().toISOString().slice(0, 10);
  const overdue = s.due_date && s.due_date < today;
  return (
    <div className="rounded-lg border-2 border-foreground/20 bg-card p-4 space-y-3 shadow-sm">
      <div className="flex items-start gap-2">
        <span className="text-xs text-muted-foreground tabular-nums mt-1">{index + 1}.</span>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold">{s.title}</h4>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <StatusPill domain="process_step" value={s.status} size="xs" />
            {s.due_date && (
              <span
                className={cn(
                  "text-[11px] tabular-nums px-1.5 py-0.5 rounded inline-flex items-center gap-1",
                  overdue ? "bg-destructive/10 text-destructive" : "text-muted-foreground",
                )}
              >
                {overdue && <AlertCircle className="h-3 w-3" />}
                Prazo: {s.due_date}
              </span>
            )}
            {showStartHint && (
              <span className="text-[11px] text-muted-foreground">
                Clique em “Iniciar processo” para começar.
              </span>
            )}
          </div>
        </div>
        <button
          onClick={onRemove}
          className="text-muted-foreground hover:text-destructive"
          title="Excluir etapa"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <div>
        <label className="text-xs font-medium">Observação</label>
        <Textarea
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          placeholder="Anotações desta etapa…"
          className="min-h-[70px] mt-1"
        />
        <div className="flex justify-end mt-1">
          <Button size="sm" variant="ghost" onClick={onSaveObservation}>
            Salvar observação
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 pt-1 border-t">
        <Button size="sm" onClick={onComplete} disabled={disabled}>
          <Check className="h-3.5 w-3.5" /> Marcar como concluída
        </Button>
        <Button size="sm" variant="outline" onClick={onDismiss} disabled={disabled}>
          <SkipForward className="h-3.5 w-3.5" /> Dispensar etapa
        </Button>
      </div>
    </div>
  );
};

