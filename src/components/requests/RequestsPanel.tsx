import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Inbox, ListChecks, Workflow, Trash2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { StatusPill } from "@/components/shared/StatusPill";
import { ViewSwitcher, type ViewMode } from "@/components/shared/ViewSwitcher";
import { EmptyState } from "@/components/shared/EmptyState";
import { REQUEST_STATUS, type RequestStatus } from "@/lib/taskTokens";
import { logActivity } from "@/lib/activityLog";
import { colorPill, asColor, type TemplateColor } from "@/components/processes/templateColors";
import { cn } from "@/lib/utils";

interface FormRow { id: string; title: string; color: string }
interface Response {
  id: string;
  form_id: string;
  submitter_name: string;
  status: RequestStatus;
  data: Record<string, unknown>;
  created_at: string;
  converted_task_id: string | null;
  converted_process_id: string | null;
}

interface Props { userId: string }

export const RequestsPanel = ({ userId }: Props) => {
  const [forms, setForms] = useState<FormRow[]>([]);
  const [responses, setResponses] = useState<Response[]>([]);
  const [view, setView] = useState<ViewMode>("table");
  const [open, setOpen] = useState<Response | null>(null);

  const load = async () => {
    const [f, r] = await Promise.all([
      supabase.from("forms").select("id,title,color"),
      supabase.from("form_responses").select("*").order("created_at", { ascending: false }),
    ]);
    setForms((f.data ?? []) as FormRow[]);
    setResponses((r.data ?? []) as unknown as Response[]);
  };
  useEffect(() => { load(); }, []);

  const formTitle = (id: string) => forms.find((f) => f.id === id)?.title ?? "—";
  const formColor = (id: string): TemplateColor => asColor(forms.find((f) => f.id === id)?.color);
  const FormPill = ({ formId }: { formId: string }) => (
    <span className={cn("inline-block text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border", colorPill[formColor(formId)])}>
      {formTitle(formId)}
    </span>
  );

  const updateStatus = async (id: string, status: RequestStatus) => {
    await supabase.from("form_responses").update({ status }).eq("id", id);
    load();
  };

  const formatData = (data: Record<string, unknown>) =>
    Object.entries(data ?? {})
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : String(v ?? "—")}`)
      .join("\n");

  const convertToTask = async (r: Response) => {
    if (r.converted_task_id) {
      return toast.info("Esta solicitação já foi convertida em tarefa.");
    }
    const title = r.submitter_name ? `${formTitle(r.form_id)} — ${r.submitter_name}` : formTitle(r.form_id);
    const notes = `Origem: solicitação de ${formTitle(r.form_id)}\n\n${formatData(r.data)}`;
    const { data, error } = await supabase.from("tasks").insert({
      user_id: userId, title, notes,
      task_date: new Date().toISOString().slice(0, 10),
      source_type: "request", source_id: r.id,
    } as never).select().single();
    if (error) return toast.error(error.message);
    await logActivity(userId, "request", r.id, "converted", `Convertida em tarefa: "${title}"`);
    await supabase.from("form_responses").update({
      status: "convertida_tarefa", converted_task_id: data!.id,
    }).eq("id", r.id);
    toast.success("Convertida em tarefa");
    setOpen(null);
    load();
  };

  const convertToProcess = async (r: Response) => {
    if (r.converted_process_id) {
      return toast.info("Esta solicitação já foi convertida em processo.");
    }
    const name = r.submitter_name ? `${formTitle(r.form_id)} — ${r.submitter_name}` : formTitle(r.form_id);
    const notes = `Origem: solicitação de ${formTitle(r.form_id)}\n\n${formatData(r.data)}`;
    const { data, error } = await supabase.from("processes").insert({
      user_id: userId, name, client_name: r.submitter_name, notes, status: "nao_iniciado",
    }).select().single();
    if (error) return toast.error(error.message);
    await logActivity(userId, "request", r.id, "converted", `Convertida em processo: "${name}"`);
    await supabase.from("form_responses").update({
      status: "convertida_processo", converted_process_id: data!.id,
    }).eq("id", r.id);
    toast.success("Convertida em processo");
    setOpen(null);
    load();
  };

  const removeResponse = async (id: string) => {
    if (!confirm("Excluir esta solicitação?")) return;
    const { error } = await supabase.from("form_responses").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Solicitação excluída");
    setOpen(null);
    load();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <ViewSwitcher value={view} onChange={setView} />
      </div>

      {responses.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Nenhuma solicitação ainda"
          description="Quando alguém preencher um formulário publicado, aparecerá aqui."
        />
      ) : view === "table" ? (
        <div className="rounded-xl border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Formulário</TableHead>
                <TableHead>Solicitante</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {responses.map((r) => (
                <TableRow key={r.id} className="cursor-pointer" onClick={() => setOpen(r)}>
                  <TableCell><FormPill formId={r.form_id} /></TableCell>
                  <TableCell>{r.submitter_name || "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <StatusPill domain="request" value={r.status} onChange={(v) => updateStatus(r.id, v as RequestStatus)} size="xs" />
                  </TableCell>
                  <TableCell></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : view === "kanban" ? (
        <div className="overflow-x-auto -mx-2 pb-2">
          <div className="flex gap-3 px-2 min-w-max">
            {REQUEST_STATUS.map((col) => {
              const items = responses.filter((r) => r.status === col.value);
              return (
                <div key={col.value} className="w-72 shrink-0">
                  <div className="text-xs font-medium text-muted-foreground mb-2 px-1 flex justify-between">
                    <span>{col.label}</span>
                    <span>{items.length}</span>
                  </div>
                  <div className="space-y-2">
                    {items.map((r) => (
                      <RequestCard key={r.id} r={r} title={formTitle(r.form_id)} onOpen={() => setOpen(r)} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : view === "cards" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {responses.map((r) => (
            <RequestCard key={r.id} r={r} title={formTitle(r.form_id)} onOpen={() => setOpen(r)} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border bg-card divide-y">
          {responses.map((r) => (
            <button
              key={r.id}
              onClick={() => setOpen(r)}
              className="w-full text-left px-4 py-3 hover:bg-muted/30 flex items-center gap-3"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{formTitle(r.form_id)}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {r.submitter_name || "Anônimo"} · {new Date(r.created_at).toLocaleString("pt-BR")}
                </p>
              </div>
              <StatusPill domain="request" value={r.status} size="xs" />
            </button>
          ))}
        </div>
      )}

      {open && (
        <Dialog open onOpenChange={(o) => !o && setOpen(null)}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{formTitle(open.form_id)}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <span className="text-muted-foreground">Solicitante:</span>
                <span className="font-medium">{open.submitter_name || "—"}</span>
                <StatusPill
                  domain="request"
                  value={open.status}
                  onChange={(v) => updateStatus(open.id, v as RequestStatus)}
                  size="xs"
                />
              </div>
              <div className="text-xs text-muted-foreground">
                Recebida em {new Date(open.created_at).toLocaleString("pt-BR")}
              </div>
              {(open.converted_task_id || open.converted_process_id) && (
                <div className="rounded-lg border border-[hsl(var(--status-aguardando))]/40 bg-[hsl(var(--status-aguardando-bg))]/40 p-3 text-xs">
                  <p className="font-medium text-foreground">
                    {open.converted_task_id ? "Já convertida em tarefa." : "Já convertida em processo."}
                  </p>
                  <p className="text-muted-foreground mt-0.5">
                    A rastreabilidade fica registrada nesta solicitação. Excluir esta entrada não remove o item criado.
                  </p>
                </div>
              )}
              <div className="rounded-lg border p-3 bg-muted/20 space-y-2">
                {Object.entries(open.data ?? {}).map(([k, v]) => (
                  <div key={k}>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{k}</p>
                    <p className="text-sm whitespace-pre-wrap">
                      {Array.isArray(v) ? v.join(", ") : String(v ?? "—")}
                    </p>
                  </div>
                ))}
                {Object.keys(open.data ?? {}).length === 0 && (
                  <p className="text-xs text-muted-foreground">Sem campos preenchidos.</p>
                )}
              </div>
            </div>
            <DialogFooter className="flex-wrap gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeResponse(open.id)}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" /> Excluir
              </Button>
              <div className="flex-1" />
              <Button
                variant="outline"
                size="sm"
                onClick={() => convertToTask(open)}
                disabled={!!open.converted_task_id}
              >
                <ListChecks className="h-4 w-4" />
                {open.converted_task_id ? "Já é tarefa" : "Converter em tarefa"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => convertToProcess(open)}
                disabled={!!open.converted_process_id}
              >
                <Workflow className="h-4 w-4" />
                {open.converted_process_id ? "Já é processo" : "Converter em processo"}
              </Button>
              <Button onClick={() => setOpen(null)}>Fechar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

const RequestCard = ({
  r, title, onOpen,
}: { r: Response; title: string; onOpen: () => void }) => {
  const converted = r.converted_task_id || r.converted_process_id;
  return (
    <button
      onClick={onOpen}
      className="text-left rounded-xl border bg-card p-4 hover:shadow-sm transition w-full"
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-semibold truncate">{title}</h4>
        <StatusPill domain="request" value={r.status} size="xs" />
      </div>
      <p className="text-xs text-muted-foreground mt-1 truncate">
        {r.submitter_name || "Anônimo"}
      </p>
      <div className="flex items-center justify-between mt-2 gap-2">
        <p className="text-[11px] text-muted-foreground">
          {new Date(r.created_at).toLocaleString("pt-BR")}
        </p>
        {converted && (
          <span className="inline-flex items-center gap-1 text-[11px] text-[hsl(var(--status-feita))]">
            <CheckCircle2 className="h-3 w-3" />
            {r.converted_task_id ? "tarefa" : "processo"}
          </span>
        )}
      </div>
    </button>
  );
};
