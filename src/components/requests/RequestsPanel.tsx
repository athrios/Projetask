import type React from "react";
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
import { Inbox, ListChecks, Workflow, Trash2, CheckCircle2, Copy, Check, Building2, Sparkles, MapPin, Activity } from "lucide-react";
import { toast } from "sonner";
import { StatusPill } from "@/components/shared/StatusPill";
import { ViewSwitcher, type ViewMode } from "@/components/shared/ViewSwitcher";
import { EmptyState } from "@/components/shared/EmptyState";
import { REQUEST_STATUS, type RequestStatus } from "@/lib/taskTokens";
import { logActivity } from "@/lib/activityLog";
import { useWorkspace } from "@/hooks/useWorkspace";
import { colorPill, asColor, type TemplateColor } from "@/components/processes/templateColors";
import { cn } from "@/lib/utils";
import {
  resolvePartnerSchema,
  type PartnerSubfield,
} from "@/components/forms/fields/partnerSchema";

interface FormRow { id: string; title: string; color: string }
interface CnpjSnapshot {
  cnpj?: string | null;
  razao_social?: string | null;
  nome_fantasia?: string | null;
  situacao?: string | null;
  endereco?: {
    logradouro?: string | null;
    numero?: string | null;
    complemento?: string | null;
    bairro?: string | null;
    cidade?: string | null;
    uf?: string | null;
    cep?: string | null;
  } | null;
  atividade_principal?: string | null;
  atividades_secundarias?: Array<{ codigo?: string | null; descricao?: string | null }> | null;
  telefone?: string | null;
  email?: string | null;
  consultado_em?: string | null;
}
interface Response {
  id: string;
  form_id: string;
  submitter_name: string;
  status: RequestStatus;
  data: Record<string, unknown>;
  created_at: string;
  converted_task_id: string | null;
  converted_process_id: string | null;
  cnpj_lookup_snapshot: CnpjSnapshot | null;
}

interface Props { userId: string }

const maskCnpjStr = (v?: string | null) => {
  const d = (v ?? "").replace(/\D/g, "").slice(0, 14);
  if (d.length !== 14) return v ?? "—";
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12, 14)}`;
};

const CnpjSnapshotBlock = ({ snapshot }: { snapshot: CnpjSnapshot }) => {
  const e = snapshot.endereco ?? {};
  const addrLine = [e.logradouro, e.numero, e.complemento].filter(Boolean).join(", ");
  const tail = [e.bairro, [e.cidade, e.uf].filter(Boolean).join("/")].filter(Boolean).join(" — ");
  const fullAddr = [addrLine, tail].filter(Boolean).join(" — ") + (e.cep ? ` — CEP ${e.cep}` : "");
  const consulted = snapshot.consultado_em
    ? new Date(snapshot.consultado_em).toLocaleString("pt-BR")
    : null;
  const Row = ({
    icon: Icon,
    label,
    value,
  }: {
    icon: typeof Building2;
    label: string;
    value: React.ReactNode;
  }) => (
    <div>
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className="text-sm text-foreground">{value ?? <span className="text-muted-foreground">—</span>}</div>
    </div>
  );
  return (
    <div className="mt-2 rounded-lg border bg-card p-4 space-y-3">
      <div>
        <div className="text-xs font-medium text-foreground">Dados públicos do CNPJ consultado</div>
        {consulted && (
          <p className="text-[11px] text-muted-foreground">Consultado em {consulted}</p>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t pt-3">
        <Row icon={Building2} label="CNPJ" value={maskCnpjStr(snapshot.cnpj)} />
        <Row icon={Building2} label="Razão social" value={snapshot.razao_social || null} />
        <Row icon={Sparkles} label="Nome fantasia" value={snapshot.nome_fantasia || null} />
        <Row icon={CheckCircle2} label="Situação" value={snapshot.situacao || null} />
      </div>
      {fullAddr.trim() && (
        <div className="border-t pt-3">
          <Row icon={MapPin} label="Endereço" value={fullAddr} />
        </div>
      )}
      {snapshot.atividade_principal && (
        <div className="border-t pt-3">
          <Row icon={Activity} label="Atividade principal" value={snapshot.atividade_principal} />
        </div>
      )}
      {snapshot.atividades_secundarias && snapshot.atividades_secundarias.length > 0 && (
        <div className="border-t pt-3">
          <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
            <ListChecks className="h-3 w-3" /> Atividades secundárias
          </div>
          <ul className="text-sm text-foreground list-disc pl-5 mt-0.5 space-y-0.5">
            {snapshot.atividades_secundarias.map((c, i) => (
              <li key={i}>{[c.codigo, c.descricao].filter(Boolean).join(" - ")}</li>
            ))}
          </ul>
        </div>
      )}
      {(snapshot.telefone || snapshot.email) && (
        <div className="border-t pt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {snapshot.telefone && <Row icon={Building2} label="Telefone" value={snapshot.telefone} />}
          {snapshot.email && <Row icon={Building2} label="E-mail" value={snapshot.email} />}
        </div>
      )}
    </div>
  );
};


const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SUBFIELD_LABELS: Record<string, string> = {
  nome: "Nome completo",
  nacionalidade: "Nacionalidade",
  naturalidade: "Naturalidade (UF / Cidade)",
  profissao: "Profissão",
  estado_civil: "Estado civil",
  regime_bens: "Regime de bens",
  endereco: "Endereço residencial",
  etnia: "Autodeclaração de etnia",
  participacao: "Participação no capital (R$)",
  uf: "UF",
  cidade: "Cidade",
  cep: "CEP",
  logradouro: "Logradouro",
  numero: "Número",
  complemento: "Complemento",
  bairro: "Bairro",
};

const prettySubLabel = (k: string) => SUBFIELD_LABELS[k] ?? k;

const formatAddress = (o: Record<string, unknown>): string => {
  const s = (k: string) => (typeof o[k] === "string" ? (o[k] as string).trim() : "");
  const line1 = [s("logradouro"), s("numero")].filter(Boolean).join(", ");
  const withCompl = s("complemento") ? `${line1} – ${s("complemento")}` : line1;
  const cityUf = [s("cidade"), s("uf")].filter(Boolean).join("/");
  const tail = [s("bairro"), cityUf].filter(Boolean).join(", ");
  const cep = s("cep") ? ` – CEP ${s("cep")}` : "";
  return [withCompl, tail].filter(Boolean).join(", ") + cep || "—";
};

const CopyButton = ({ getText, className }: { getText: () => string; className?: string }) => {
  const [done, setDone] = useState(false);
  const onClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      await navigator.clipboard.writeText(getText());
      setDone(true);
      toast.success("Copiado");
      setTimeout(() => setDone(false), 1500);
    } catch {
      toast.error("Não foi possível copiar");
    }
  };
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Copiar"
      title="Copiar"
      className={cn(
        "inline-flex items-center justify-center h-6 w-6 rounded text-muted-foreground hover:text-foreground hover:bg-muted shrink-0",
        className,
      )}
    >
      {done ? <Check className="h-3.5 w-3.5 text-[hsl(var(--status-feita))]" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
};

export const RequestsPanel = ({ userId }: Props) => {
  const { workspaceId } = useWorkspace();
  const [forms, setForms] = useState<FormRow[]>([]);
  const [responses, setResponses] = useState<Response[]>([]);
  const [processNames, setProcessNames] = useState<Record<string, string>>({});
  const [view, setView] = useState<ViewMode>("table");
  const [open, setOpen] = useState<Response | null>(null);
  const [openFormLabels, setOpenFormLabels] = useState<Set<string>>(new Set());
  const [openFieldOrder, setOpenFieldOrder] = useState<Map<string, number>>(new Map());

  const load = async () => {
    if (!workspaceId) return;
    const [f, r] = await Promise.all([
      supabase.from("forms").select("id,title,color").eq("workspace_id", workspaceId),
      supabase.from("form_responses").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false }),
    ]);
    setForms((f.data ?? []) as FormRow[]);
    const rs = (r.data ?? []) as unknown as Response[];
    setResponses(rs);
    const ids = Array.from(new Set(rs.map((x) => x.converted_process_id).filter(Boolean) as string[]));
    if (ids.length) {
      const { data: procs } = await supabase.from("processes").select("id,name").in("id", ids);
      const m: Record<string, string> = {};
      (procs ?? []).forEach((p: { id: string; name: string }) => { m[p.id] = p.name; });
      setProcessNames(m);
    } else {
      setProcessNames({});
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [workspaceId]);

  // Carrega os labels reais das perguntas do formulário aberto, para validar chaves técnicas
  useEffect(() => {
    if (!open) { setOpenFormLabels(new Set()); setOpenFieldOrder(new Map()); return; }
    let cancel = false;
    (async () => {
      const { data } = await supabase
        .from("form_fields")
        .select("label,position")
        .eq("form_id", open.form_id)
        .order("position", { ascending: true });
      if (cancel) return;
      const rows = (data ?? []) as Array<{ label: string; position: number }>;
      setOpenFormLabels(new Set(rows.map((x) => x.label)));
      const ord = new Map<string, number>();
      rows.forEach((x, i) => ord.set(x.label, i));
      setOpenFieldOrder(ord);
    })();
    return () => { cancel = true; };
  }, [open]);

  const orderedEntries = (data: Record<string, unknown> | null | undefined) => {
    const entries = Object.entries(data ?? {});
    return entries.sort(([a], [b]) => {
      const ai = openFieldOrder.has(a) ? (openFieldOrder.get(a) as number) : Number.MAX_SAFE_INTEGER;
      const bi = openFieldOrder.has(b) ? (openFieldOrder.get(b) as number) : Number.MAX_SAFE_INTEGER;
      return ai - bi;
    });
  };

  const renderKey = (k: string) => {
    if (openFormLabels.has(k)) return k;
    if (UUID_RE.test(k)) return "Pergunta não encontrada";
    return k;
  };

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

  const formatValue = (v: unknown): string => {
    if (v === null || v === undefined || v === "") return "—";
    if (Array.isArray(v)) {
      return v
        .map((x, i) =>
          x && typeof x === "object"
            ? `\n  ${i + 1}) ${Object.entries(x as Record<string, unknown>)
                .map(([kk, vv]) => `${prettySubLabel(kk)}: ${formatValue(vv)}`)
                .join("; ")}`
            : String(x),
        )
        .join(", ");
    }
    if (typeof v === "object") {
      const o = v as Record<string, unknown>;
      if ("cep" in o || "logradouro" in o || "numero" in o) return formatAddress(o);
      if ("uf" in o || "cidade" in o) return `${o.uf ?? "—"} / ${o.cidade ?? "—"}`;
      return Object.entries(o)
        .map(([kk, vv]) => `${prettySubLabel(kk)}: ${formatValue(vv)}`)
        .join("; ");
    }
    return String(v);
  };

  const formatData = (data: Record<string, unknown>) =>
    orderedEntries(data)
      .map(([k, v]) => `${renderKey(k)}: ${formatValue(v)}`)
      .join("\n");

  const convertToTask = async (r: Response) => {
    if (!workspaceId) return;
    if (r.converted_task_id) {
      return toast.info("Esta solicitação já foi convertida em tarefa.");
    }
    const title = r.submitter_name ? `${formTitle(r.form_id)} — ${r.submitter_name}` : formTitle(r.form_id);
    const notes = `Origem: solicitação de ${formTitle(r.form_id)}\n\n${formatData(r.data)}`;
    const { data, error } = await supabase.from("tasks").insert({
      user_id: userId, workspace_id: workspaceId, title, notes,
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
    if (!workspaceId) return;
    if (r.converted_process_id) {
      return toast.info("Esta solicitação já está vinculada a um processo.");
    }
    const name = r.submitter_name ? `${formTitle(r.form_id)} — ${r.submitter_name}` : formTitle(r.form_id);
    const notes = `Origem: solicitação de ${formTitle(r.form_id)}\n\n${formatData(r.data)}`;
    const { data, error } = await supabase.from("processes").insert({
      user_id: userId, workspace_id: workspaceId, name, client_name: r.submitter_name, notes, status: "nao_iniciado",
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

  const openProcess = (processId: string) => {
    window.location.hash = `processo-${processId}`;
    toast.info("Acesse a aba Processos para visualizar.");
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
                      <RequestCard key={r.id} r={r} title={formTitle(r.form_id)} color={formColor(r.form_id)} onOpen={() => setOpen(r)} />
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
            <RequestCard key={r.id} r={r} title={formTitle(r.form_id)} color={formColor(r.form_id)} onOpen={() => setOpen(r)} />
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
                <FormPill formId={r.form_id} />
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
          <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle asChild>
                <div><FormPill formId={open.form_id} /></div>
              </DialogTitle>
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
                <div className="rounded-lg border border-[hsl(var(--status-aguardando))]/40 bg-[hsl(var(--status-aguardando-bg))]/40 p-3 text-xs space-y-1">
                  <p className="font-medium text-foreground">
                    {open.converted_task_id
                      ? "Já convertida em tarefa."
                      : `Processo criado: ${processNames[open.converted_process_id!] ?? "—"}`}
                  </p>
                  <p className="text-muted-foreground">
                    A rastreabilidade fica registrada nesta solicitação. Excluir esta entrada não remove o item criado.
                  </p>
                </div>
              )}

              <div className="rounded-lg border p-3 bg-muted/20 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Respostas</p>
                  <button
                    type="button"
                    onClick={async (e) => {
                      e.stopPropagation();
                      try {
                        await navigator.clipboard.writeText(formatData(open.data));
                        toast.success("Copiado");
                      } catch {
                        toast.error("Não foi possível copiar");
                      }
                    }}
                    className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    <Copy className="h-3 w-3" /> Copiar tudo
                  </button>
                </div>
                {orderedEntries(open.data).map(([k, v]) => {
                  const isFile =
                    v && typeof v === "object" && !Array.isArray(v) && "path" in (v as object);
                  const isPartnerList =
                    Array.isArray(v) &&
                    v.length > 0 &&
                    typeof v[0] === "object" &&
                    v[0] !== null &&
                    !Array.isArray(v[0]);
                  const isAddress =
                    v &&
                    typeof v === "object" &&
                    !Array.isArray(v) &&
                    ("cep" in (v as object) || "logradouro" in (v as object) || "numero" in (v as object));
                  const isStateCity =
                    !isAddress &&
                    v &&
                    typeof v === "object" &&
                    !Array.isArray(v) &&
                    ("uf" in (v as object) || "cidade" in (v as object));
                  const labelDisplay = renderKey(k);
                  const isMissing = labelDisplay === "Pergunta não encontrada";
                  return (
                    <div key={k}>
                      <p className={cn(
                        "text-[11px] uppercase tracking-wide text-muted-foreground",
                        isMissing && "italic",
                      )}>
                        {labelDisplay}
                      </p>
                      {isFile ? (
                        <div className="flex items-center gap-2">
                          <FileLink file={v as { path: string; name: string }} />
                          <CopyButton getText={() => (v as { name: string }).name} />
                        </div>
                      ) : isAddress ? (
                        <div className="flex items-start gap-2">
                          <p className="text-sm flex-1 whitespace-pre-wrap">
                            {formatAddress(v as Record<string, unknown>)}
                          </p>
                          <CopyButton getText={() => formatAddress(v as Record<string, unknown>)} />
                        </div>
                      ) : isStateCity ? (
                        <div className="flex items-start gap-2">
                          <p className="text-sm flex-1">
                            {(v as { uf?: string }).uf ?? "—"} / {(v as { cidade?: string }).cidade ?? "—"}
                          </p>
                          <CopyButton getText={() => formatValue(v)} />
                        </div>
                      ) : isPartnerList ? (
                        <div className="space-y-2 mt-1">
                          {(v as Array<Record<string, unknown>>).map((row, i) => (
                            <div key={i} className="rounded-md border p-2 bg-background text-xs space-y-0.5">
                              <div className="flex items-center justify-between mb-1">
                                <p className="font-semibold">Sócio {i + 1}</p>
                                <CopyButton
                                  getText={() =>
                                    Object.entries(row)
                                      .map(([kk, vv]) => `${prettySubLabel(kk)}: ${formatValue(vv)}`)
                                      .join("\n")
                                  }
                                />
                              </div>
                              {Object.entries(row).map(([kk, vv]) => (
                                <div key={kk} className="flex items-start gap-2">
                                  <p className="flex-1">
                                    <span className="text-muted-foreground">{prettySubLabel(kk)}: </span>
                                    {formatValue(vv)}
                                  </p>
                                  <CopyButton getText={() => formatValue(vv)} />
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex items-start gap-2">
                          <p className="text-sm whitespace-pre-wrap flex-1">{formatValue(v)}</p>
                          <CopyButton getText={() => formatValue(v)} />
                        </div>
                      )}
                    </div>
                  );
                })}
                {Object.keys(open.data ?? {}).length === 0 && (
                  <p className="text-xs text-muted-foreground">Sem campos preenchidos.</p>
                )}
                {open.cnpj_lookup_snapshot && (
                  <CnpjSnapshotBlock snapshot={open.cnpj_lookup_snapshot} />
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
              {open.converted_process_id ? (
                <Button variant="outline" size="sm" onClick={() => openProcess(open.converted_process_id!)}>
                  <Workflow className="h-4 w-4" /> Abrir processo
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={() => convertToProcess(open)}>
                  <Workflow className="h-4 w-4" /> Converter em processo
                </Button>
              )}

              <Button onClick={() => setOpen(null)}>Fechar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

const RequestCard = ({
  r, title, color, onOpen,
}: { r: Response; title: string; color: TemplateColor; onOpen: () => void }) => {
  const converted = r.converted_task_id || r.converted_process_id;
  return (
    <button
      onClick={onOpen}
      className="text-left rounded-xl border bg-card p-4 hover:shadow-sm transition w-full"
    >
      <div className="flex items-start justify-between gap-2">
        <span className={cn("inline-block text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border", colorPill[color])}>
          {title}
        </span>
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

const FileLink = ({ file }: { file: { path: string; name: string } }) => {
  const open = async () => {
    const { data, error } = await supabase.storage
      .from("form-uploads")
      .createSignedUrl(file.path, 60);
    if (error || !data) return toast.error("Não foi possível abrir o arquivo");
    window.open(data.signedUrl, "_blank");
  };
  return (
    <button onClick={open} className="text-sm text-primary underline underline-offset-2 hover:opacity-80 truncate">
      📎 {file.name}
    </button>
  );
};
