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
import { Plus, Trash2, Settings2, Workflow, ChevronRight, Check, History, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { StatusPill } from "@/components/shared/StatusPill";
import { ViewSwitcher, type ViewMode } from "@/components/shared/ViewSwitcher";
import { EmptyState } from "@/components/shared/EmptyState";
import { PROCESS_STATUS, type ProcessStatus } from "@/lib/taskTokens";
import { logActivity } from "@/lib/activityLog";
import { ActivityLogList } from "@/components/shared/ActivityLogList";
import { addDaysISO } from "@/lib/recurrence";

interface Template {
  id: string;
  name: string;
  description: string;
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
    setProcesses(procs);
    if (procs.length) {
      const { data: s } = await supabase
        .from("process_steps")
        .select("*")
        .in("process_id", procs.map((x) => x.id))
        .order("position", { ascending: true });
      const grouped: Record<string, Step[]> = {};
      (s ?? []).forEach((row) => {
        (grouped[row.process_id] ||= []).push(row as unknown as Step);
      });
      setStepsByProc(grouped);
    } else setStepsByProc({});
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createProcess = async (templateId: string | null, name: string) => {
    const tpl = templates.find((t) => t.id === templateId);
    const { data: proc, error } = await supabase
      .from("processes")
      .insert({
        user_id: userId,
        name,
        template_id: templateId,
        status: "nao_iniciado",
      })
      .select()
      .single();
    if (error || !proc) return toast.error(error?.message ?? "Erro");

    if (templateId) {
      const { data: tmplSteps } = await supabase
        .from("process_template_steps")
        .select("*")
        .eq("template_id", templateId)
        .order("position", { ascending: true });
      const rows = (tmplSteps ?? []).map((s, i) => ({
        process_id: proc.id,
        user_id: userId,
        position: i,
        title: s.title,
        status: "pendente" as const,
      }));
      if (rows.length) await supabase.from("process_steps").insert(rows);
    }
    toast.success(tpl ? `Processo criado a partir de ${tpl.name}` : "Processo criado");
    load();
  };

  const updateProcess = async (id: string, patch: Partial<Process>) => {
    const { error } = await supabase.from("processes").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    if (patch.status) toast.success("Status atualizado");
    load();
  };

  const removeProcess = async (id: string) => {
    if (!confirm("Excluir processo e todas as etapas?")) return;
    const { error } = await supabase.from("processes").delete().eq("id", id);
    if (error) return toast.error(error.message);
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
          onOpen={setOpenProc}
          onStatus={(p, s) => updateProcess(p.id, { status: s })}
        />
      ) : view === "list" ? (
        <ListView
          processes={processes}
          stepsByProc={stepsByProc}
          onOpen={setOpenProc}
          onStatus={(p, s) => updateProcess(p.id, { status: s })}
          onRemove={removeProcess}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {processes.map((p) => (
            <ProcessCard
              key={p.id}
              p={p}
              steps={stepsByProc[p.id] ?? []}
              onOpen={() => setOpenProc(p)}
              onStatus={(s) => updateProcess(p.id, { status: s })}
            />
          ))}
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

/* ───────── Sub-components ───────── */

const ProcessCard = ({
  p,
  steps,
  onOpen,
  onStatus,
}: {
  p: Process;
  steps: Step[];
  onOpen: () => void;
  onStatus: (s: ProcessStatus) => void;
}) => {
  const done = steps.filter((s) => s.status === "feita").length;
  const total = steps.length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const current = steps.find((s) => s.status !== "feita" && s.status !== "pulado");
  return (
    <div className="rounded-xl border bg-card p-4 hover:shadow-sm transition group">
      <div className="flex items-start justify-between gap-2">
        <button onClick={onOpen} className="text-left flex-1 min-w-0">
          <h4 className="text-sm font-semibold truncate">{p.name}</h4>
          {p.client_name && (
            <p className="text-xs text-muted-foreground truncate">{p.client_name}</p>
          )}
        </button>
        <StatusPill domain="process" value={p.status} onChange={(v) => onStatus(v as ProcessStatus)} size="xs" />
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
            <span className="truncate">{current.title}</span>
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
  onStatus,
  onRemove,
}: {
  processes: Process[];
  stepsByProc: Record<string, Step[]>;
  onOpen: (p: Process) => void;
  onStatus: (p: Process, s: ProcessStatus) => void;
  onRemove: (id: string) => void;
}) => (
  <div className="rounded-xl border bg-card divide-y">
    {processes.map((p) => {
      const steps = stepsByProc[p.id] ?? [];
      const done = steps.filter((s) => s.status === "feita").length;
      return (
        <div key={p.id} className="px-4 py-3 flex items-center gap-3 group hover:bg-muted/30">
          <button onClick={() => onOpen(p)} className="flex-1 min-w-0 text-left">
            <p className="text-sm font-medium truncate">{p.name}</p>
            <p className="text-xs text-muted-foreground truncate">
              {p.client_name || "—"} · {done}/{steps.length} etapas
            </p>
          </button>
          <StatusPill domain="process" value={p.status} onChange={(v) => onStatus(p, v as ProcessStatus)} size="xs" />
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
  onOpen,
  onStatus,
}: {
  processes: Process[];
  stepsByProc: Record<string, Step[]>;
  onOpen: (p: Process) => void;
  onStatus: (p: Process, s: ProcessStatus) => void;
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
              {items.map((p) => (
                <ProcessCard
                  key={p.id}
                  p={p}
                  steps={stepsByProc[p.id] ?? []}
                  onOpen={() => onOpen(p)}
                  onStatus={(s) => onStatus(p, s)}
                />
              ))}
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
  onCreate: (templateId: string | null, name: string) => void;
}) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [tpl, setTpl] = useState<string>("none");
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
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button
            onClick={() => {
              if (!name.trim()) return toast.error("Nome obrigatório");
              onCreate(tpl === "none" ? null : tpl, name.trim());
              setOpen(false); setName(""); setTpl("none");
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
                        <span className="flex-1">{s.title}</span>
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
  const [stepInput, setStepInput] = useState("");

  const save = async () => {
    const { error } = await supabase.from("processes").update({
      name, client_name: client, due_date: due || null, notes,
    }).eq("id", process.id);
    if (error) return toast.error(error.message);
    toast.success("Processo atualizado");
    onChanged(); onClose();
  };

  const toggleStep = async (s: Step) => {
    const next = s.status === "feita" ? "pendente" : "feita";
    await supabase.from("process_steps").update({
      status: next, completed_at: next === "feita" ? new Date().toISOString() : null,
    }).eq("id", s.id);
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
    await supabase.from("process_steps").delete().eq("id", id);
    onChanged();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{process.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
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
            <label className="text-xs font-medium">Observações</label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-[80px]" />
          </div>
          <div>
            <h4 className="text-sm font-semibold mb-2">Etapas</h4>
            <ol className="space-y-1.5">
              {steps.map((s, i) => (
                <li key={s.id} className="flex items-center gap-2 group rounded px-2 py-1 hover:bg-muted/40">
                  <button
                    onClick={() => toggleStep(s)}
                    className={cn(
                      "h-5 w-5 rounded border flex items-center justify-center shrink-0",
                      s.status === "feita" ? "bg-foreground border-foreground text-background" : "border-input",
                    )}
                  >
                    {s.status === "feita" && <Check className="h-3 w-3" />}
                  </button>
                  <span className="text-xs text-muted-foreground w-5">{i + 1}.</span>
                  <span className={cn("text-sm flex-1", s.status === "feita" && "line-through text-muted-foreground")}>
                    {s.title}
                  </span>
                  <button
                    onClick={() => removeStep(s.id)}
                    className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ol>
            <form
              className="flex gap-2 mt-2"
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
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
          <Button onClick={save}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
